/**
 * Full 3D visualization with all visual effects
 */

import { useRef, useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';

interface NodeData extends d3.SimulationNodeDatum {
    id: string;
    type: 'center' | 'validator' | 'leaf';
    name?: string;
    r: number;
    color?: string;
    meta?: any;
    parent?: NodeData;
    aggregatedData?: any;
    leafMeta?: any;
    leafDistance?: number;
}

interface LinkData extends d3.SimulationLinkDatum<NodeData> {
    type: 'primary' | 'leaf';
}

interface NetworkGraphProps {
    className?: string;
    isDark?: boolean;
}

export default function NetworkGraph({ className = '', isDark = true }: NetworkGraphProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const simulationRef = useRef<d3.Simulation<NodeData, LinkData> | null>(null);

    const [liveData, setLiveData] = useState<{
        trades: any[];
        agents: any[];
        venues: any[];
    }>({
        trades: [],
        agents: [],
        venues: []
    });

    const COLORS = useMemo(() => ({
        bg: isDark ? '#0a0e1a' : '#f8fafc',
        purple: '#9945FF',
        green: '#14F195',
        cyan: '#00D4FF',
        highlight: '#F08C56',
        gray: isDark ? '#E5E7EB' : '#1f2937',
    }), [isDark]);

    // Fetch live data - no fallback to mock data
    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch(`${import.meta.env.VITE_API_URL || 'https://api.relaycore.xyz'}/graphql`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        query: `{
                            trades(limit: 30) { id pair venue { name } }
                            agents(limit: 20) { id name }
                            venues { name }
                        }`
                    })
                });
                const { data } = await response.json();
                setLiveData({
                    trades: data?.trades || [],
                    agents: data?.agents || [],
                    venues: data?.venues || []
                });
            } catch (e) {
                // No mock data - show empty state
                setLiveData({
                    trades: [],
                    agents: [],
                    venues: []
                });
            }
        };
        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, []);

    // Generate nodes and links
    const { nodes, links } = useMemo(() => {
        if (!containerRef.current) return { nodes: [], links: [] };

        const width = containerRef.current.offsetWidth || 800;
        const height = containerRef.current.offsetHeight || 600;

        const nodes: NodeData[] = [];
        const links: LinkData[] = [];

        // Center node
        nodes.push({
            id: 'ROOT',
            type: 'center',
            x: width / 2,
            y: height / 2,
            r: 60
        });

        // Group trades by venue
        const venueMap = new Map<string, any[]>();
        liveData.trades.forEach(trade => {
            const venueName = trade.venue?.name || 'Unknown';
            if (!venueMap.has(venueName)) venueMap.set(venueName, []);
            venueMap.get(venueName)!.push(trade);
        });

        let clusterIndex = 0;
        venueMap.forEach((venueTrades, venueName) => {
            const clusterId = `val-${clusterIndex}`;
            const angle = (clusterIndex / venueMap.size) * 2 * Math.PI;
            const radius = 180;

            const validatorNode: NodeData = {
                id: clusterId,
                type: 'validator',
                name: venueName,
                meta: { color: [COLORS.purple, COLORS.cyan, COLORS.green][clusterIndex % 3] },
                x: width / 2 + Math.cos(angle) * radius,
                y: height / 2 + Math.sin(angle) * radius,
                r: 35
            };
            nodes.push(validatorNode);
            links.push({ source: 'ROOT', target: clusterId, type: 'primary' });

            // Leaf nodes (trades)
            const leafCount = venueTrades.length;
            const baseDistance = 250;
            const arcSpread = Math.PI / 3.5;
            const numLevels = 6;
            const leavesPerLevel = Math.ceil(leafCount / numLevels);

            venueTrades.forEach((trade, j) => {
                const level = Math.floor(j / leavesPerLevel);
                const indexInLevel = j % leavesPerLevel;
                const totalInLevel = Math.min(leavesPerLevel, leafCount - level * leavesPerLevel);

                const levelDistance = baseDistance + (level * 35);
                const leafAngleOffset = (indexInLevel / Math.max(totalInLevel - 1, 1)) * arcSpread - arcSpread / 2;
                const leafAngle = angle + leafAngleOffset;

                nodes.push({
                    id: `${clusterId}-leaf-${j}`,
                    type: 'leaf',
                    parent: validatorNode,
                    leafMeta: trade,
                    r: 6,
                    x: validatorNode.x! + Math.cos(leafAngle) * levelDistance,
                    y: validatorNode.y! + Math.sin(leafAngle) * levelDistance,
                    leafDistance: levelDistance
                });
                links.push({ source: clusterId, target: `${clusterId}-leaf-${j}`, type: 'leaf' });
            });

            clusterIndex++;
        });

        return { nodes, links };
    }, [liveData, COLORS]);

    // Render D3
    useEffect(() => {
        if (!containerRef.current || !svgRef.current || nodes.length === 0) return;

        const width = containerRef.current.offsetWidth;
        const height = containerRef.current.offsetHeight || 600;

        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        // Defs
        const defs = svg.append('defs');

        // Gradient
        const logoGradient = defs.append('linearGradient').attr('id', 'solanaGradient');
        logoGradient.append('stop').attr('offset', '0%').attr('stop-color', '#14F195');
        logoGradient.append('stop').attr('offset', '50%').attr('stop-color', '#9945FF');
        logoGradient.append('stop').attr('offset', '100%').attr('stop-color', '#00D4FF');

        // Glow filter
        const glowFilter = defs.append('filter').attr('id', 'glow');
        glowFilter.append('feGaussianBlur').attr('stdDeviation', '1.5');
        const feMerge = glowFilter.append('feMerge');
        feMerge.append('feMergeNode');
        feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

        // Drop shadow
        const dropShadow = defs.append('filter').attr('id', 'dropShadow');
        dropShadow.append('feGaussianBlur').attr('in', 'SourceAlpha').attr('stdDeviation', '2');
        dropShadow.append('feOffset').attr('dx', '0').attr('dy', '1');

        const g = svg.append('g');

        // Zoom
        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.4, 4])
            .on('zoom', (event) => g.attr('transform', event.transform));
        svg.call(zoom);

        // Simulation
        const simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink<NodeData, LinkData>(links)
                .id(d => d.id)
                .distance(d => d.type === 'leaf' ? (d.target as NodeData).leafDistance || 200 : 1)
                .strength(d => d.type === 'leaf' ? 0.9 : 0))
            .force('charge', d3.forceManyBody<NodeData>().strength(d => d.type === 'leaf' ? -2 : 0))
            .force('collide', d3.forceCollide<NodeData>().radius(d => d.type === 'leaf' ? 6 : 0))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('x', d3.forceX<NodeData>(d => d.type === 'center' ? width / 2 : d.x!).strength(d => d.type === 'center' ? 1 : 0.1))
            .force('y', d3.forceY<NodeData>(d => d.type === 'center' ? height / 2 : d.y!).strength(d => d.type === 'center' ? 1 : 0.1))
            .alphaDecay(0.05);

        simulationRef.current = simulation;

        // Links
        const link = g.append('g')
            .selectAll('line')
            .data(links)
            .join('line')
            .attr('stroke', 'rgba(100, 100, 100, 0.3)')
            .attr('stroke-width', d => d.type === 'primary' ? 0 : 0.6)
            .attr('stroke-opacity', 0.5);

        // Nodes
        const node = g.append('g')
            .selectAll('g')
            .data(nodes)
            .join('g')
            .style('cursor', 'pointer');

        // Validator nodes
        const valGroup = node.filter(d => d.type === 'validator');
        valGroup.append('circle')
            .attr('r', d => (d.r || 26) + 6)
            .attr('fill', d => d.meta?.color || COLORS.cyan)
            .attr('opacity', 0.15);

        valGroup.append('circle')
            .attr('r', d => d.r || 26)
            .attr('fill', isDark ? 'rgba(10, 14, 26, 0.95)' : 'rgba(255, 255, 255, 0.95)')
            .attr('stroke', d => d.meta?.color || COLORS.cyan)
            .attr('stroke-width', 2.5)
            .style('filter', 'url(#dropShadow)');

        valGroup.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', 5)
            .attr('font-size', '12px')
            .attr('font-weight', 'bold')
            .attr('fill', isDark ? '#fff' : '#000')
            .text(d => d.name || '');

        // Leaf nodes (3D boxes)
        const leafGroup = node.filter(d => d.type === 'leaf');
        leafGroup.each(function (d) {
            const g = d3.select(this);
            const boxSize = (d.r || 6) * 2;
            const depth = boxSize / 3;
            const parentColor = d.parent?.meta?.color || COLORS.cyan;

            // Shadow
            g.append('ellipse')
                .attr('cx', 1)
                .attr('cy', boxSize / 2 + 2)
                .attr('rx', boxSize / 2)
                .attr('ry', 1.5)
                .attr('fill', '#000')
                .attr('opacity', 0.2);

            // Top face
            g.append('path')
                .attr('d', `M ${-boxSize / 2} ${-boxSize / 2} L ${boxSize / 2} ${-boxSize / 2} L ${boxSize / 2 + depth} ${-boxSize / 2 - depth} L ${-boxSize / 2 + depth} ${-boxSize / 2 - depth} Z`)
                .attr('fill', d3.color(parentColor)?.darker(0.5)?.toString() || '#14F195')
                .attr('opacity', 0.8);

            // Right face
            g.append('path')
                .attr('d', `M ${boxSize / 2} ${-boxSize / 2} L ${boxSize / 2} ${boxSize / 2} L ${boxSize / 2 + depth} ${boxSize / 2 - depth} L ${boxSize / 2 + depth} ${-boxSize / 2 - depth} Z`)
                .attr('fill', d3.color(parentColor)?.darker(0.8)?.toString() || '#0ea86e')
                .attr('opacity', 0.75);

            // Front face
            g.append('rect')
                .attr('x', -boxSize / 2)
                .attr('y', -boxSize / 2)
                .attr('width', boxSize)
                .attr('height', boxSize)
                .attr('rx', 1)
                .attr('fill', parentColor)
                .attr('opacity', 0.9);

            // Highlight
            g.append('line')
                .attr('x1', -boxSize / 2)
                .attr('y1', -boxSize / 2)
                .attr('x2', boxSize / 2)
                .attr('y2', -boxSize / 2)
                .attr('stroke', '#fff')
                .attr('stroke-width', 0.4)
                .attr('opacity', 0.4);
        });

        // Center node
        const centerGroup = node.filter(d => d.type === 'center');
        centerGroup.raise();
        centerGroup.append('circle')
            .attr('r', 60)
            .attr('fill', isDark ? '#0a0e1a' : '#ffffff')
            .attr('stroke', 'url(#solanaGradient)')
            .attr('stroke-width', 3)
            .style('filter', 'url(#glow)');

        centerGroup.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', 5)
            .attr('font-size', '16px')
            .attr('font-weight', 'bold')
            .attr('fill', '#FFD84D')
            .text('Relay Core');

        // Tick
        simulation.on('tick', () => {
            link
                .attr('x1', (d: any) => d.source.x)
                .attr('y1', (d: any) => d.source.y)
                .attr('x2', (d: any) => d.target.x)
                .attr('y2', (d: any) => d.target.y);

            node.attr('transform', d => `translate(${d.x},${d.y})`);
        });

        return () => simulation.stop();
    }, [nodes, links, isDark, COLORS]);

    const bgClass = isDark
        ? 'bg-gradient-to-br from-[#0a0e1a] via-[#0f1420] to-[#1a0f2e]'
        : 'bg-gradient-to-br from-gray-50 via-white to-gray-100';

    return (
        <div ref={containerRef} className={`relative ${bgClass} rounded-lg ${className}`}>
            <svg ref={svgRef} width="100%" height="100%" style={{ minHeight: '600px' }} />
            {isDark && (
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/3 rounded-full blur-3xl"></div>
                    <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/3 rounded-full blur-3xl"></div>
                </div>
            )}

            {/* Stats */}
            <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-sm px-4 py-3 rounded-lg border border-gray-800">
                <div className="text-white space-y-1">
                    <div className="font-bold text-sm">Live Ecosystem</div>
                    <div className="text-xs text-gray-300">{liveData.trades.length} trades</div>
                    <div className="text-xs text-gray-300">{liveData.agents.length} agents</div>
                    <div className="text-xs text-gray-500 mt-2">{nodes.length} nodes</div>
                </div>
            </div>
        </div>
    );
}
