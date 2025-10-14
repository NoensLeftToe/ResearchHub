import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, filters } = await req.json();
    console.log('Searching PubMed for:', query);

    // Step 1: Search PubMed for article IDs (request more to ensure 40+ unique after deduplication)
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=100&retmode=json`;
    
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();
    
    const pmids = searchData.esearchresult?.idlist || [];
    console.log('Found PMIDs:', pmids.length);

    if (pmids.length === 0) {
      return new Response(
        JSON.stringify({ articles: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Fetch article details
    const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${pmids.join(',')}&retmode=xml`;
    
    const fetchResponse = await fetch(fetchUrl);
    const xmlText = await fetchResponse.text();

    // Parse XML to extract article data
    const articles = parseArticles(xmlText);
    console.log('Parsed articles before deduplication:', articles.length);

    // Deduplicate articles
    const uniqueArticles = deduplicateArticles(articles);
    console.log('Unique articles after deduplication:', uniqueArticles.length);

    return new Response(
      JSON.stringify({ articles: uniqueArticles }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in search-pubmed function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage, articles: [] }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

function parseArticles(xmlText: string) {
  const articles = [];
  
  // Extract all PubmedArticle blocks at once
  const articlePattern = /<PubmedArticle>[\s\S]*?<\/PubmedArticle>/gi;
  const articleBlocks = xmlText.match(articlePattern) || [];
  
  console.log('Found article blocks:', articleBlocks.length);
  
  // Parse each article block individually
  for (const articleXml of articleBlocks) {
    try {
      // Extract PMID from the article block
      const pmidMatch = articleXml.match(/<PMID[^>]*>(.*?)<\/PMID>/i);
      const pmid = pmidMatch ? pmidMatch[1] : null;
      
      if (!pmid) {
        console.warn('Article block missing PMID, skipping');
        continue;
      }
      
      // Extract title
      const titleMatch = articleXml.match(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/i);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '') : 'No title available';
      
      // Extract abstract
      const abstractMatch = articleXml.match(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/i);
      const abstract = abstractMatch ? abstractMatch[1].replace(/<[^>]*>/g, '') : 'No abstract available';
      
      // Extract authors
      const authors = [];
      const authorMatches = articleXml.matchAll(/<Author[^>]*>[\s\S]*?<LastName>(.*?)<\/LastName>[\s\S]*?<ForeName>(.*?)<\/ForeName>[\s\S]*?<\/Author>/gi);
      for (const match of authorMatches) {
        authors.push(`${match[2]} ${match[1]}`);
      }
      
      // Extract journal
      const journalMatch = articleXml.match(/<Title>(.*?)<\/Title>/i);
      const journal = journalMatch ? journalMatch[1] : 'Unknown journal';
      
      // Extract publication date
      const yearMatch = articleXml.match(/<PubDate>[\s\S]*?<Year>(.*?)<\/Year>/i);
      const monthMatch = articleXml.match(/<PubDate>[\s\S]*?<Month>(.*?)<\/Month>/i);
      const pubDate = yearMatch ? `${monthMatch ? monthMatch[1] + ' ' : ''}${yearMatch[1]}` : 'Unknown date';
      
      // Extract DOI
      const doiMatch = articleXml.match(/<ArticleId IdType="doi">(.*?)<\/ArticleId>/i);
      const doi = doiMatch ? doiMatch[1] : null;
      
      // Extract publication year for deduplication
      const year = yearMatch ? yearMatch[1] : null;
      
      articles.push({
        pmid,
        title,
        authors: authors.length > 0 ? authors : ['Unknown authors'],
        journal,
        pubDate,
        abstract: abstract.slice(0, 500),
        doi,
        year,
      });
    } catch (error) {
      console.error('Error parsing article block:', error);
    }
  }
  
  return articles;
}

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

function deduplicateArticles(articles: any[]) {
  const uniqueMap = new Map();
  const doiMap = new Map();
  
  for (const article of articles) {
    // Priority 1: Use DOI as unique identifier if available
    if (article.doi && article.doi.trim() !== '') {
      const normalizedDoi = normalizeString(article.doi);
      if (doiMap.has(normalizedDoi)) {
        continue; // Skip duplicate DOI
      }
      doiMap.set(normalizedDoi, true);
      uniqueMap.set(article.pmid, article);
      continue;
    }
    
    // Priority 2: Match on normalized title + first author + year
    const normalizedTitle = normalizeString(article.title);
    const firstAuthor = article.authors && article.authors.length > 0 
      ? normalizeString(article.authors[0]) 
      : '';
    const year = article.year || '';
    
    // Create composite key
    const compositeKey = `${normalizedTitle}|${firstAuthor}|${year}`;
    
    // Check for exact match
    if (uniqueMap.has(compositeKey)) {
      continue; // Skip duplicate
    }
    
    // Check for fuzzy title match with same first author
    let isDuplicate = false;
    for (const [key, existingArticle] of uniqueMap.entries()) {
      if (typeof key === 'string' && key.includes('|')) {
        const [existingTitle, existingAuthor, existingYear] = key.split('|');
        
        // If same first author and year, check title similarity
        if (existingAuthor === firstAuthor && existingYear === year) {
          const similarity = calculateSimilarity(normalizedTitle, existingTitle);
          if (similarity > 0.85) { // 85% similarity threshold
            isDuplicate = true;
            break;
          }
        }
      }
    }
    
    if (!isDuplicate) {
      uniqueMap.set(compositeKey, article);
    }
  }
  
  return Array.from(uniqueMap.values());
}

function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}
