import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, X } from "lucide-react";
import type { Article } from "@/pages/Search";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface NetworkVisualizationProps {
  articles: Article[];
}

interface Node {
  id: string;
  label: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface Link {
  source: string | Node;
  target: string | Node;
}

export const NetworkVisualization = ({ articles }: NetworkVisualizationProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [allArticles, setAllArticles] = useState<Article[]>(articles);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [loadingNode, setLoadingNode] = useState<string | null>(null);
  const [allLinks, setAllLinks] = useState<Link[]>([]);

  // Update allArticles when articles prop changes
  useEffect(() => {
    setAllArticles(articles);
    setExpandedNodes(new Set());
    setAllLinks([]);
  }, [articles]);

  // Fetch related articles when a node is clicked
  const fetchRelatedArticles = async (pmid: string) => {
    if (expandedNodes.has(pmid)) {
      toast.info("This node has already been expanded");
      return;
    }

    setLoadingNode(pmid);

    try {
      const { data, error } = await supabase.functions.invoke('get-related-articles', {
        body: { pmid }
      });

      if (error) throw error;

      const relatedArticles = data.articles || [];

      if (relatedArticles.length === 0) {
        toast.info("No related articles found");
        setLoadingNode(null);
        return;
      }

      // Filter out articles that already exist
      const existingPmids = new Set(allArticles.map(a => a.pmid));
      const newArticles = relatedArticles.filter((a: Article) => !existingPmids.has(a.pmid));

      if (newArticles.length === 0) {
        toast.info("All related articles are already displayed");
        setExpandedNodes(prev => new Set([...prev, pmid]));
        setLoadingNode(null);
        return;
      }

      // Add new articles
      setAllArticles(prev => [...prev, ...newArticles]);

      // Create links from clicked node to new nodes
      const newLinks = newArticles.map((article: Article) => ({
        source: pmid,
        target: article.pmid
      }));

      setAllLinks(prev => [...prev, ...newLinks]);
      setExpandedNodes(prev => new Set([...prev, pmid]));

      toast.success(`Added ${newArticles.length} related articles`);
    } catch (error) {
      console.error('Error fetching related articles:', error);
      toast.error("Failed to fetch related articles");
    } finally {
      setLoadingNode(null);
    }
  };

  // Determine visible articles capped at 20, prioritizing expanded nodes
  const visibleArticles = (() => {
    if (allArticles.length <= 20) return allArticles;

    const expandedPmids = Array.from(expandedNodes);

    // Start with expanded articles
    let selectedArticles = allArticles.filter(a => expandedPmids.includes(a.pmid));

    // Fill remaining slots with original order excluding already included
    if (selectedArticles.length < 20) {
      const remaining = allArticles.filter(a => !expandedPmids.includes(a.pmid));
      selectedArticles = selectedArticles.concat(remaining.slice(0, 20 - selectedArticles.length));
    }

    return selectedArticles.slice(0, 20);
  })();

  // Filter links to those connecting visible articles only
  const visiblePmidsSet = new Set(visibleArticles.map(a => a.pmid));
  const visibleLinks = allLinks.filter(link =>
    visiblePmidsSet.has(typeof link.source === 'string' ? link.source : (link.source as Node).id) &&
    visiblePmidsSet.has(typeof link.target === 'string' ? link.target : (link.target as Node).id)
  );

  useEffect(() => {
    if (!canvasRef.current || visibleArticles.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Create nodes from visible articles
    const nodes: Node[] = visibleArticles.map((article) => ({
      id: article.pmid,
      label: article.title.slice(0, 30) + "...",
      x: (rect.width / 2) + (Math.random() - 0.5) * 400,
      y: (rect.height / 2) + (Math.random() - 0.5) * 400,
      vx: 0,
      vy: 0,
    }));

    const links: Link[] = visibleLinks.length > 0 ? visibleLinks : [];

    if (visibleLinks.length === 0) {
      const originalArticleCount = Math.min(20, articles.length);
      for (let i = 0; i < originalArticleCount - 1; i++) {
        if (Math.random() > 0.6) {
          links.push({
            source: visibleArticles[i].pmid,
            target: visibleArticles[i + 1].pmid,
          });
        }
      }
    }

    // Simple force-directed layout simulation
    const simulate = () => {
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      nodes.forEach((node) => {
        node.vx = ((centerX - (node.x || 0)) * 0.01) + (node.vx || 0) * 0.85;
        node.vy = ((centerY - (node.y || 0)) * 0.01) + (node.vy || 0) * 0.85;

        node.x = (node.x || 0) + (node.vx || 0);
        node.y = (node.y || 0) + (node.vy || 0);

        node.x = Math.max(30, Math.min(rect.width - 30, node.x));
        node.y = Math.max(30, Math.min(rect.height - 30, node.y));
      });

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = (nodes[j].x || 0) - (nodes[i].x || 0);
          const dy = (nodes[j].y || 0) - (nodes[i].y || 0);
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 100) {
            const force = (100 - dist) / 100;
            nodes[i].vx = (nodes[i].vx || 0) - (dx / dist) * force;
            nodes[i].vy = (nodes[i].vy || 0) - (dy / dist) * force;
            nodes[j].vx = (nodes[j].vx || 0) + (dx / dist) * force;
            nodes[j].vy = (nodes[j].vy || 0) + (dy / dist) * force;
          }
        }
      }
    };

    const render = () => {
      ctx.clearRect(0, 0, rect.width, rect.height);

      // Draw links
      ctx.strokeStyle = "hsl(239 84% 32% / 0.3)";
      ctx.lineWidth = 1;
      links.forEach((link) => {
        const sourceNode = nodes.find((n) => n.id === (typeof link.source === 'string' ? link.source : link.source.id));
        const targetNode = nodes.find((n) => n.id === (typeof link.target === 'string' ? link.target : link.target.id));
        if (sourceNode && targetNode) {
          ctx.beginPath();
          ctx.moveTo(sourceNode.x || 0, sourceNode.y || 0);
          ctx.lineTo(targetNode.x || 0, targetNode.y || 0);
          ctx.stroke();
        }
      });

      // Draw nodes
      nodes.forEach((node) => {
        const isHovered = hoveredNode === node.id;
        const isSelected = selectedArticle?.pmid === node.id;
        const isExpanded = expandedNodes.has(node.id);
        const isLoading = loadingNode === node.id;
        const radius = isHovered || isSelected ? 12 : 8;

        if (isHovered || isSelected || isExpanded) {
          ctx.beginPath();
          ctx.arc(node.x || 0, node.y || 0, radius + 4, 0, 2 * Math.PI);
          ctx.fillStyle = isExpanded ? "hsl(142 76% 36% / 0.3)" : "hsl(243 75% 59% / 0.3)";
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(node.x || 0, node.y || 0, radius, 0, 2 * Math.PI);

        if (isLoading) {
          ctx.fillStyle = "hsl(48 96% 53%)";
        } else if (isExpanded) {
          ctx.fillStyle = "hsl(142 76% 36%)";
        } else if (isSelected) {
          ctx.fillStyle = "hsl(270 95% 75%)";
        } else {
          ctx.fillStyle = "hsl(239 84% 32%)";
        }

        ctx.fill();
        ctx.strokeStyle = isHovered ? "hsl(270 95% 75%)" : "hsl(243 75% 59%)";
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.stroke();

        ctx.fillStyle = "hsl(230 35% 15%)";
        ctx.font = isHovered || isSelected ? "bold 11px system-ui" : "10px system-ui";
        ctx.fillText(node.label, (node.x || 0) + radius + 4, (node.y || 0) + 4);
      });
    };

    let animationId: number;
    let iterations = 0;
    const maxIterations = 200;

    const animate = () => {
      if (iterations < maxIterations) {
        simulate();
        iterations++;
      }
      render();
      animationId = requestAnimationFrame(animate);
    };

    animate();

    const handleMouseMove = (e: MouseEvent) => {
      const canvasRect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - canvasRect.left;
      const mouseY = e.clientY - canvasRect.top;

      let foundNode: string | null = null;
      for (const node of nodes) {
        const dx = mouseX - (node.x || 0);
        const dy = mouseY - (node.y || 0);
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 12) {
          foundNode = node.id;
          canvas.style.cursor = 'pointer';
          break;
        }
      }

      if (!foundNode) {
        canvas.style.cursor = 'default';
      }

      setHoveredNode(foundNode);
    };

    const handleClick = (e: MouseEvent) => {
      const canvasRect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - canvasRect.left;
      const mouseY = e.clientY - canvasRect.top;

      for (const node of nodes) {
        const dx = mouseX - (node.x || 0);
        const dy = mouseY - (node.y || 0);
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 12) {
          const article = allArticles.find(a => a.pmid === node.id);
          setSelectedArticle(article || null);

          fetchRelatedArticles(node.id);
          break;
        }
      }
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleClick);

    return () => {
      cancelAnimationFrame(animationId);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('click', handleClick);
    };
  }, [
    visibleArticles,
    hoveredNode,
    selectedArticle,
    visibleLinks,
    expandedNodes,
    loadingNode,
    allArticles,
  ]);

  // Extract keywords & formatCitation functions remain unchanged
  const extractKeywords = (article: Article): string[] => {
    const text = `${article.title} ${article.abstract}`.toLowerCase();
    const commonWords = new Set([
      'the','a','an','and','or','but','in','on','at','to','for','of','with','by','from',
      'as','is','was','are','were','been','be','have','has','had','do','does','did','will',
      'would','could','should','may','might','must','can','this','that','these','those','we',
      'they','our','their'
    ]);
    const words = text.match(/\b[a-z]{4,}\b/g) || [];
    const wordFreq = new Map<string, number>();
    words.forEach(word => {
      if (!commonWords.has(word)) {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
      }
    });
    return Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  };

  const formatCitation = (article: Article): string => {
    const authors = article.authors.length > 3
      ? `${article.authors.slice(0, 3).join(", ")} et al.`
      : article.authors.join(", ");
    return `${authors} (${article.pubDate}). ${article.title}. ${article.journal}. PMID: ${article.pmid}`;
  };

  if (articles.length === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-muted-foreground">
          No articles to visualize. Perform a search first.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="p-4 lg:col-span-2">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Article Network Graph</h3>
          <p className="text-sm text-muted-foreground">
            Click on any node to expand and view related articles • Showing {allArticles.length} articles
          </p>
          <div className="flex gap-4 mt-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "hsl(239 84% 32%)" }} />
              <span>Default</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "hsl(142 76% 36%)" }} />
              <span>Expanded</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "hsl(48 96% 53%)" }} />
              <span>Loading</span>
            </div>
          </div>
        </div>
        <div className="relative w-full h-[600px] bg-muted/30 rounded-lg overflow-hidden">
          <canvas
            ref={canvasRef}
            className="w-full h-full"
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      </Card>

      {selectedArticle && (
        <Card className="p-4 lg:col-span-1 relative animate-fade-in">
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-2 right-2"
            onClick={() => setSelectedArticle(null)}
          >
            <X className="w-4 h-4" />
          </Button>

          <div className="space-y-4 mt-2">
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                SELECTED ARTICLE
              </h3>
              <h4 className="text-lg font-bold leading-tight mb-2">
                {selectedArticle.title}
              </h4>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                Citation
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="h-6 w-6 p-0"
                >
                  <a
                    href={`https://pubmed.ncbi.nlm.nih.gov/${selectedArticle.pmid}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </Button>
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed p-3 bg-muted/50 rounded-lg">
                {formatCitation(selectedArticle)}
              </p>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2">Keywords</h4>
              <div className="flex flex-wrap gap-2">
                {extractKeywords(selectedArticle).map((keyword, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="capitalize"
                  >
                    {keyword}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2">Abstract</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {selectedArticle.abstract}
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
