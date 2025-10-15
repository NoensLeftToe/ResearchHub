import { useEffect, useRef, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ExternalLink, X, Link as LinkIcon, RotateCcw, Shuffle, Search, Eye } from "lucide-react";
import type { Article } from "@/pages/Search";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as d3 from "d3";

interface NetworkVisualizationProps {
  articles: Article[];
}

interface Node extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  article: Article;
  authorName: string;
  year: string;
  isHighlighted: boolean;
  citationCount: number;
}

interface Link extends d3.SimulationLinkDatum<Node> {
  source: Node | string;
  target: Node | string;
  isHighlighted: boolean;
}

export const NetworkVisualization = ({ articles }: NetworkVisualizationProps) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [allArticles, setAllArticles] = useState<Article[]>(articles);
  const [allLinks, setAllLinks] = useState<Link[]>([]);
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(new Set());
  const [highlightedPath, setHighlightedPath] = useState<Set<string>>(new Set());
  
  // Control states
  const [connectionMode, setConnectionMode] = useState<boolean>(false);
  const [firstSelectedNode, setFirstSelectedNode] = useState<string | null>(null);
  const [pathMode, setPathMode] = useState<boolean>(true); // Enable path highlighting by default
  const [showAllNodes, setShowAllNodes] = useState<boolean>(true);
  const [pathDepth, setPathDepth] = useState<number>(2); // How many levels to highlight

  useEffect(() => {
    setAllArticles(articles);
    if (articles.length > 1) {
      generateLitmapsConnections(articles.slice(0, 15));
    }
    setConnectionMode(false);
    setFirstSelectedNode(null);
    setHighlightedNodes(new Set());
  }, [articles]);

  // Generate Litmaps-style connections (citation network)
  const generateLitmapsConnections = useCallback((visibleArticles: Article[]) => {
    const connections: Link[] = [];
    
    // Sort articles by year to create citation flow
    const sortedArticles = [...visibleArticles].sort((a, b) => 
      new Date(a.pubDate).getFullYear() - new Date(b.pubDate).getFullYear()
    );
    
    // Create connections where newer papers cite older ones
    for (let i = 1; i < sortedArticles.length; i++) {
      const currentArticle = sortedArticles[i];
      
      // Connect to 1-3 previous articles (older papers that this might cite)
      const maxPrevious = Math.min(3, i);
      const numConnections = Math.min(Math.floor(Math.random() * 2) + 1, maxPrevious);
      
      for (let j = 0; j < numConnections; j++) {
        const targetIndex = Math.max(0, i - Math.floor(Math.random() * Math.min(i, 4)) - 1);
        const targetArticle = sortedArticles[targetIndex];
        
        if (targetIndex < i) {
          const exists = connections.some(conn => 
            conn.source === targetArticle.pmid && conn.target === currentArticle.pmid
          );
          
          if (!exists) {
            connections.push({ 
              source: targetArticle.pmid, 
              target: currentArticle.pmid,
              isHighlighted: false
            });
          }
        }
      }
    }
    
    setAllLinks(connections);
  }, []);

  // Find path between nodes using BFS
  const findPath = useCallback((startId: string, maxDepth: number = 2) => {
    const visited = new Set<string>();
    const queue: {nodeId: string, depth: number}[] = [{nodeId: startId, depth: 0}];
    const pathNodes = new Set<string>();
    const pathLinks = new Set<string>();
    
    while (queue.length > 0) {
      const {nodeId, depth} = queue.shift()!;
      
      if (visited.has(nodeId) || depth > maxDepth) continue;
      
      visited.add(nodeId);
      pathNodes.add(nodeId);
      
      // Find connected nodes
      allLinks.forEach(link => {
        const sourceId = typeof link.source === 'string' ? link.source : (link.source as Node).id;
        const targetId = typeof link.target === 'string' ? link.target : (link.target as Node).id;
        
        let connectedNode: string | null = null;
        let linkId: string | null = null;
        
        if (sourceId === nodeId && !visited.has(targetId)) {
          connectedNode = targetId;
          linkId = `${sourceId}-${targetId}`;
        } else if (targetId === nodeId && !visited.has(sourceId)) {
          connectedNode = sourceId;
          linkId = `${sourceId}-${targetId}`;
        }
        
        if (connectedNode && linkId && depth < maxDepth) {
          pathNodes.add(connectedNode);
          pathLinks.add(linkId);
          queue.push({nodeId: connectedNode, depth: depth + 1});
        }
      });
    }
    
    return { nodes: pathNodes, links: pathLinks };
  }, [allLinks]);

  // Handle node click for path highlighting
  const handleNodeClick = useCallback((nodeId: string, article: Article) => {
    if (connectionMode) {
      // Handle connection mode
      if (!firstSelectedNode) {
        setFirstSelectedNode(nodeId);
        toast.info("First node selected. Click another node to connect.");
      } else if (firstSelectedNode === nodeId) {
        setFirstSelectedNode(null);
        toast.info("Node deselected.");
      } else {
        const newLink: Link = {
          source: firstSelectedNode,
          target: nodeId,
          isHighlighted: false
        };
        setAllLinks(prev => [...prev, newLink]);
        setFirstSelectedNode(null);
        toast.success("Nodes connected!");
      }
    } else if (pathMode) {
      // Handle path highlighting
      setSelectedArticle(article);
      const path = findPath(nodeId, pathDepth);
      setHighlightedPath(path.nodes);
      setHighlightedNodes(path.nodes);
    } else {
      // Normal selection
      setSelectedArticle(article);
      setHighlightedNodes(new Set([nodeId]));
      setHighlightedPath(new Set());
    }
  }, [connectionMode, pathMode, pathDepth, firstSelectedNode, findPath]);

  // Clear highlighting
  const clearHighlighting = useCallback(() => {
    setHighlightedNodes(new Set());
    setHighlightedPath(new Set());
    setSelectedArticle(null);
  }, []);

  // Show limited articles for performance
  const visibleArticles = allArticles.slice(0, 15);

  // Prepare data for visualization
  const prepareData = useCallback(() => {
    const nodes: Node[] = visibleArticles.map(article => {
      const firstAuthor = article.authors?.[0] || "Unknown";
      const year = new Date(article.pubDate).getFullYear().toString();
      
      return {
        id: article.pmid,
        label: article.title.length > 30 ? article.title.slice(0, 30) + "..." : article.title,
        article,
        authorName: firstAuthor.length > 15 ? firstAuthor.slice(0, 15) + "..." : firstAuthor,
        year,
        isHighlighted: highlightedNodes.has(article.pmid),
        citationCount: Math.floor(Math.random() * 100) // Mock citation count
      };
    });

    const nodeIds = new Set(nodes.map(n => n.id));
    const links: Link[] = allLinks
      .filter(link => {
        const sourceId = typeof link.source === 'string' ? link.source : (link.source as Node).id;
        const targetId = typeof link.target === 'string' ? link.target : (link.target as Node).id;
        return nodeIds.has(sourceId) && nodeIds.has(targetId);
      })
      .map(link => ({
        ...link,
        isHighlighted: highlightedPath.size > 0 && (
          highlightedPath.has(typeof link.source === 'string' ? link.source : (link.source as Node).id) ||
          highlightedPath.has(typeof link.target === 'string' ? link.target : (link.target as Node).id)
        )
      }));

    return { nodes, links };
  }, [visibleArticles, allLinks, highlightedNodes, highlightedPath]);

  // Main visualization effect
  useEffect(() => {
    if (!svgRef.current || visibleArticles.length === 0) return;

    const svg = d3.select(svgRef.current);
    const width = 900;
    const height = 700;

    svg.selectAll("*").remove();

    const { nodes, links } = prepareData();

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);

    const g = svg.append("g");

    // Create simulation
    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink<Node, Link>(links)
        .id(d => d.id)
        .distance(180)
        .strength(0.4))
      .force("charge", d3.forceManyBody()
        .strength(-1500)
        .distanceMin(80)
        .distanceMax(400))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(50))
      .alphaDecay(0.015)
      .alphaMin(0.003);

    // Run simulation to settle positions
    for (let i = 0; i < 500; ++i) {
      simulation.tick();
    }
    simulation.stop();

    // Create links
    const link = g.append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", d => d.isHighlighted ? "#3b82f6" : "#e2e8f0")
      .attr("stroke-opacity", d => d.isHighlighted ? 0.8 : 0.3)
      .attr("stroke-width", d => d.isHighlighted ? 3 : 1)
      .attr("x1", d => (d.source as Node).x!)
      .attr("y1", d => (d.source as Node).y!)
      .attr("x2", d => (d.target as Node).x!)
      .attr("y2", d => (d.target as Node).y!);

    // Create nodes
    const node = g.append("g")
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", d => {
        if (d.isHighlighted) return 25;
        return showAllNodes ? 15 : 8;
      })
      .attr("cx", d => d.x!)
      .attr("cy", d => d.y!)
      .attr("fill", d => {
        if (firstSelectedNode === d.id) return "#ef4444";
        if (d.isHighlighted) return "#3b82f6";
        return showAllNodes ? "#94a3b8" : "#e2e8f0";
      })
      .attr("stroke", d => d.isHighlighted ? "#ffffff" : "none")
      .attr("stroke-width", d => d.isHighlighted ? 3 : 0)
      .attr("opacity", d => {
        if (highlightedNodes.size === 0) return 1;
        return d.isHighlighted ? 1 : (showAllNodes ? 0.4 : 0.15);
      })
      .style("cursor", "pointer")
      .call(d3.drag<SVGCircleElement, Node>()
        .on("drag", (event, d) => {
          d.x = event.x;
          d.y = event.y;
          d3.select(event.sourceEvent.target).attr("cx", d.x).attr("cy", d.y);
          link.attr("x1", d => (d.source as Node).x!)
              .attr("y1", d => (d.source as Node).y!)
              .attr("x2", d => (d.target as Node).x!)
              .attr("y2", d => (d.target as Node).y!);
          labels.attr("x", d => d.x!).attr("y", d => d.y!);
        }));

    // Create labels (author, year)
    const labels = g.append("g")
      .selectAll("text")
      .data(nodes.filter(d => d.isHighlighted || showAllNodes))
      .join("text")
      .attr("x", d => d.x!)
      .attr("y", d => d.y! + (d.isHighlighted ? 45 : 35))
      .attr("text-anchor", "middle")
      .style("font-size", d => d.isHighlighted ? "13px" : "11px")
      .style("font-weight", d => d.isHighlighted ? "700" : "500")
      .style("fill", d => d.isHighlighted ? "#1e40af" : "#64748b")
      .style("opacity", d => {
        if (highlightedNodes.size === 0) return 1;
        return d.isHighlighted ? 1 : 0.6;
      })
      .style("pointer-events", "none")
      .text(d => `${d.authorName}, ${d.year}`);

    // Event handlers
    node.on("click", (event, d) => {
      handleNodeClick(d.id, d.article);
    });

    return () => {
      simulation.stop();
    };
  }, [visibleArticles, allLinks, highlightedNodes, highlightedPath, showAllNodes, firstSelectedNode, connectionMode, handleNodeClick, prepareData]);

  if (articles.length === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-muted-foreground">No articles to visualize. Perform a search first.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Litmaps-style Controls */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Literature Citation Network</h3>
            <p className="text-sm text-muted-foreground">
              Click any node to explore citation paths and connections
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={clearHighlighting}>
              <Eye className="w-4 h-4 mr-2" />
              Clear Highlight
            </Button>
            <Button variant="outline" size="sm" onClick={() => generateLitmapsConnections(visibleArticles)}>
              <Shuffle className="w-4 h-4 mr-2" />
              Regenerate
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          <div className="flex items-center space-x-2">
            <Switch checked={pathMode} onCheckedChange={setPathMode} />
            <label className="text-sm font-medium">Path Highlighting</label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch checked={showAllNodes} onCheckedChange={setShowAllNodes} />
            <label className="text-sm font-medium">Show All Nodes</label>
          </div>
          
          <div className="space-y-1">
            <label className="text-sm font-medium">Path Depth: {pathDepth}</label>
            <Slider
              value={[pathDepth]}
              onValueChange={([value]) => setPathDepth(value)}
              min={1}
              max={4}
              step={1}
              className="w-full"
            />
          </div>

          <div className="text-sm text-muted-foreground">
            {visibleArticles.length} articles • {allLinks.length} citations
          </div>
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-blue-500 border-2 border-white" />
            <span>Highlighted Node</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-slate-400" />
            <span>Background Node</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-blue-500" />
            <span>Citation Path</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-slate-300" />
            <span>Background Connection</span>
          </div>
        </div>
      </Card>

      {/* Main Visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="p-4 lg:col-span-3">
          <div className="relative w-full h-[700px] bg-white rounded-lg overflow-hidden border">
            <svg
              ref={svgRef}
              width="100%"
              height="100%"
              viewBox="0 0 900 700"
              className="w-full h-full"
            />
          </div>
        </Card>

        {/* Selected Article Panel */}
        {selectedArticle && (
          <Card className="p-4 lg:col-span-1">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium">Selected Paper</h4>
              <Button variant="ghost" size="sm" onClick={() => {
                setSelectedArticle(null);
                clearHighlighting();
              }}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <h5 className="font-semibold text-sm mb-2 line-clamp-3">{selectedArticle.title}</h5>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-xs">
                    {new Date(selectedArticle.pubDate).getFullYear()}
                  </Badge>
                  <Button variant="ghost" size="sm" asChild className="h-6 w-6 p-0">
                    <a href={`https://pubmed.ncbi.nlm.nih.gov/${selectedArticle.pmid}/`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </Button>
                </div>
              </div>

              <div>
                <h6 className="text-sm font-medium mb-2">Authors</h6>
                <p className="text-xs text-muted-foreground">
                  {selectedArticle.authors?.slice(0, 3).join(", ") || "Unknown authors"}
                  {selectedArticle.authors && selectedArticle.authors.length > 3 && " et al."}
                </p>
              </div>

              <div>
                <h6 className="text-sm font-medium mb-2">Journal</h6>
                <p className="text-xs text-muted-foreground">{selectedArticle.journal || "Unknown journal"}</p>
              </div>

              <div>
                <h6 className="text-sm font-medium mb-2">Abstract</h6>
                <p className="text-xs text-muted-foreground leading-relaxed max-h-40 overflow-y-auto">
                  {selectedArticle.abstract}
                </p>
              </div>

              <div>
                <h6 className="text-sm font-medium mb-2">Network Info</h6>
                <div className="text-xs space-y-1">
                  <p>Connected papers: {highlightedPath.size - 1}</p>
                  <p>Citation depth: {pathDepth} levels</p>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};
