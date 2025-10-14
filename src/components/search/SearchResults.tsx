import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, BookOpen } from "lucide-react";
import type { Article } from "@/pages/Search";

interface SearchResultsProps {
  articles: Article[];
  loading?: boolean;
}

export const SearchResults = ({ articles, loading }: SearchResultsProps) => {
  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="p-6 animate-pulse">
            <div className="h-6 bg-muted rounded w-3/4 mb-4" />
            <div className="h-4 bg-muted rounded w-1/4 mb-2" />
            <div className="h-20 bg-muted rounded w-full" />
          </Card>
        ))}
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <Card className="p-12 text-center">
        <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-xl font-semibold mb-2">No results found</h3>
        <p className="text-muted-foreground">
          Try adjusting your search terms or filters
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground mb-4">
        Found {articles.length} articles
      </div>
      {articles.map((article) => (
        <Card key={article.pmid} className="p-6 hover:shadow-lg transition-shadow">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-xl font-semibold leading-tight hover:text-primary transition-colors">
                {article.title}
              </h3>
              <Button variant="ghost" size="sm" asChild>
                <a 
                  href={`https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 items-center text-sm text-muted-foreground">
              <span className="font-medium">{article.authors.slice(0, 3).join(", ")}</span>
              {article.authors.length > 3 && <span>et al.</span>}
              <span>•</span>
              <span>{article.journal}</span>
              <span>•</span>
              <span>{article.pubDate}</span>
            </div>

            <Badge variant="secondary" className="font-mono">
              PMID: {article.pmid}
            </Badge>

            <p className="text-sm text-muted-foreground line-clamp-3">
              {article.abstract}
            </p>
          </div>
        </Card>
      ))}
    </div>
  );
};
