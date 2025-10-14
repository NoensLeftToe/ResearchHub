import { Button } from "@/components/ui/button";
import { Search, Network, TrendingUp, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

const Index = () => {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary-glow to-accent opacity-10" />
        <div className="container mx-auto px-4 py-20 relative">
          <div className="text-center max-w-4xl mx-auto space-y-8 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">
                Powered by PubMed & Advanced Visualization
              </span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
              Discover Research
              <span className="block bg-gradient-to-r from-primary via-primary-glow to-accent bg-clip-text text-transparent">
                Like Never Before
              </span>
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Search millions of research articles, visualize connections, and uncover hidden relationships in scientific literature with our intelligent platform.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link to="/search">
                <Button size="lg" className="gap-2 shadow-lg hover:shadow-xl transition-all">
                  <Search className="w-5 h-5" />
                  Start Searching
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="gap-2">
                <Network className="w-5 h-5" />
                View Demo
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-6 rounded-xl bg-card border border-border hover:border-primary/50 transition-all hover:shadow-lg">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center mb-4">
                <Search className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Powerful Search</h3>
              <p className="text-muted-foreground">
                Access millions of research articles from PubMed with advanced filtering and semantic search capabilities.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-card border border-border hover:border-primary/50 transition-all hover:shadow-lg">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-secondary to-accent flex items-center justify-center mb-4">
                <Network className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Network Visualization</h3>
              <p className="text-muted-foreground">
                Explore relationships between papers through interactive network graphs showing citations and co-citations.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-card border border-border hover:border-primary/50 transition-all hover:shadow-lg">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-accent to-primary-glow flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Trend Analysis</h3>
              <p className="text-muted-foreground">
                Discover emerging research trends, popular keywords, and influential papers in your field of interest.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center space-y-6 p-12 rounded-2xl bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10 border border-primary/20">
            <h2 className="text-3xl md:text-4xl font-bold">
              Ready to Transform Your Research?
            </h2>
            <p className="text-lg text-muted-foreground">
              Join researchers worldwide who are discovering connections in scientific literature.
            </p>
            <Link to="/search">
              <Button size="lg" className="gap-2 shadow-lg">
                Get Started Free
                <Search className="w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
