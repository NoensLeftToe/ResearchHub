import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

interface SearchBarProps {
  onSearch: (query: string, filters: any) => void;
  loading?: boolean;
}

export const SearchBar = ({ onSearch, loading }: SearchBarProps) => {
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
      toast.error("Please enter a search query");
      return;
    }
    onSearch(query, {});
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
          <Input
            type="text"
            placeholder="Search for research articles, authors, topics..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 h-12 text-lg"
            disabled={loading}
          />
        </div>
        <Button 
          type="submit" 
          size="lg" 
          disabled={loading}
          className="gap-2"
        >
          {loading ? "Searching..." : "Search"}
        </Button>
        <Button 
          type="button" 
          variant="outline" 
          size="lg"
          className="gap-2"
        >
          <SlidersHorizontal className="w-5 h-5" />
        </Button>
      </div>
    </form>
  );
};
