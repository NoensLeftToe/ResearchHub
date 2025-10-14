import { useState } from "react";
import { SearchBar } from "@/components/search/SearchBar";
import { SearchResults } from "@/components/search/SearchResults";
import { NetworkVisualization } from "@/components/visualization/NetworkVisualization";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { List, Network } from "lucide-react";

export interface Article {
  pmid: string;
  title: string;
  authors: string[];
  journal: string;
  pubDate: string;
  abstract: string;
  doi?: string;
  year?: string;
}

const Search = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (query: string, filters: any) => {
    setLoading(true);
    // This will call our edge function
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-pubmed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ query, filters }),
      });

      const data = await response.json();
      setArticles(data.articles || []);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary via-primary-glow to-accent bg-clip-text text-transparent">
            Search Research Articles
          </h1>
          <p className="text-muted-foreground">
            Search millions of articles from PubMed and visualize their connections
          </p>
        </div>

        <SearchBar onSearch={handleSearch} loading={loading} />

        {articles.length > 0 && (
          <div className="mt-8">
            <Tabs defaultValue="list" className="w-full">
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="list" className="gap-2">
                  <List className="w-4 h-4" />
                  List View
                </TabsTrigger>
                <TabsTrigger value="network" className="gap-2">
                  <Network className="w-4 h-4" />
                  Network View
                </TabsTrigger>
              </TabsList>

              <TabsContent value="list" className="mt-6">
                <SearchResults articles={articles} loading={loading} />
              </TabsContent>

              <TabsContent value="network" className="mt-6">
                <NetworkVisualization articles={articles} />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  );
};

export default Search;
