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
    const { pmid } = await req.json();
    console.log('Fetching related articles for PMID:', pmid);

    // Step 1: Get related article PMIDs using elink
    const elinkUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/elink.fcgi?dbfrom=pubmed&db=pubmed&id=${pmid}&retmode=json`;
    
    const elinkResponse = await fetch(elinkUrl);
    const elinkData = await elinkResponse.json();
    
    // Extract related PMIDs (limit to 10 for performance)
    const relatedPmids = elinkData.linksets?.[0]?.linksetdbs?.[0]?.links?.slice(0, 10) || [];
    console.log('Found related PMIDs:', relatedPmids.length);

    if (relatedPmids.length === 0) {
      return new Response(
        JSON.stringify({ articles: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Fetch article details for related PMIDs
    const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${relatedPmids.join(',')}&retmode=xml`;
    
    const fetchResponse = await fetch(fetchUrl);
    const xmlText = await fetchResponse.text();

    // Parse XML to extract article data
    const articles = parseArticles(xmlText);
    console.log('Parsed related articles:', articles.length);

    return new Response(
      JSON.stringify({ articles }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in get-related-articles function:', error);
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
  
  // Parse each article block individually
  for (const articleXml of articleBlocks) {
    try {
      // Extract PMID from the article block
      const pmidMatch = articleXml.match(/<PMID[^>]*>(.*?)<\/PMID>/i);
      const pmid = pmidMatch ? pmidMatch[1] : null;
      
      if (!pmid) continue;
      
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
      
      // Extract publication year
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
