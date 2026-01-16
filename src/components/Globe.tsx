/**
 * World Globe - amCharts 5 3D Globe
 * Mobile-compatible rotating globe with node markers
 */

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5map from '@amcharts/amcharts5/map';
import am5geodata_worldLow from '@amcharts/amcharts5-geodata/worldLow';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';

interface GlobeProps {
    className?: string;
}

export default function Globe({ className = '' }: GlobeProps) {
    const chartRef = useRef<HTMLDivElement>(null);
    const rootRef = useRef<am5.Root | null>(null);

    const mapData = useMemo(() => {
        // Major trading hubs
        const hubs = [
            { lat: 40.7128, lng: -74.0060, name: 'New York', count: 12 },
            { lat: 51.5074, lng: -0.1278, name: 'London', count: 15 },
            { lat: 35.6762, lng: 139.6503, name: 'Tokyo', count: 10 },
            { lat: 1.3521, lng: 103.8198, name: 'Singapore', count: 8 },
            { lat: 22.3193, lng: 114.1694, name: 'Hong Kong', count: 7 },
            { lat: -33.8688, lng: 151.2093, name: 'Sydney', count: 5 },
            { lat: 37.7749, lng: -122.4194, name: 'San Francisco', count: 14 },
            { lat: 52.5200, lng: 13.4050, name: 'Berlin', count: 6 },
        ];

        return hubs.map(hub => ({
            latitude: hub.lat,
            longitude: hub.lng,
            title: hub.name,
            info: `${hub.count} nodes\n${Math.floor(hub.count * 0.8)} online`,
            color: '#9945FF',
        }));
    }, []);

    useLayoutEffect(() => {
        if (!chartRef.current) return;

        const root = am5.Root.new(chartRef.current);
        rootRef.current = root;

        root.setThemes([am5themes_Animated.new(root)]);

        const chart = root.container.children.push(
            am5map.MapChart.new(root, {
                panX: 'rotateX',
                panY: 'rotateY',
                projection: am5map.geoOrthographic(),
                paddingBottom: 0,
                paddingTop: 0,
                paddingLeft: 0,
                paddingRight: 0,
            })
        );

        // Background
        const backgroundSeries = chart.series.unshift(
            am5map.MapPolygonSeries.new(root, {})
        );

        backgroundSeries.mapPolygons.template.setAll({
            fill: am5.color(0x0a0e1a),
            fillOpacity: 1,
            strokeOpacity: 0,
        });

        backgroundSeries.data.push({
            geometry: am5map.getGeoRectangle(90, 180, -90, -180),
        });

        // Graticule (grid lines)
        const graticuleSeries = chart.series.unshift(
            am5map.GraticuleSeries.new(root, {
                step: 10,
            })
        );

        graticuleSeries.mapLines.template.setAll({
            stroke: am5.color(0x4a5568),
            strokeOpacity: 0.3,
        });

        // Continents
        const polygonSeries = chart.series.push(
            am5map.MapPolygonSeries.new(root, {
                geoJSON: am5geodata_worldLow,
            })
        );

        polygonSeries.mapPolygons.template.setAll({
            fill: am5.color(0x2d3748),
            stroke: am5.color(0x1a202c),
            strokeWidth: 0.5,
        });

        // Points (markers)
        const pointSeries = chart.series.push(
            am5map.MapPointSeries.new(root, {
                latitudeField: 'latitude',
                longitudeField: 'longitude',
            })
        );

        pointSeries.bullets.push((root, series, dataItem) => {
            const container = am5.Container.new(root, {});

            const circle = container.children.push(
                am5.Circle.new(root, {
                    radius: 6,
                    tooltipY: 0,
                    fill: am5.color(0x9945FF),
                    strokeWidth: 2,
                    stroke: am5.color(0xffffff),
                    tooltipText: '{title}\\n{info}',
                    cursorOverStyle: 'pointer',
                })
            );

            // Pulse animation
            circle.animate({
                key: 'scale',
                from: 1,
                to: 1.3,
                duration: 1000,
                easing: am5.ease.yoyo(am5.ease.inOut(am5.ease.cubic)),
                loops: Infinity,
            });

            circle.events.on('pointerover', () => {
                circle.set('fill', am5.color(0x14F195));
                circle.set('radius', 10);
            });

            circle.events.on('pointerout', () => {
                circle.set('fill', am5.color(0x9945FF));
                circle.set('radius', 6);
            });

            return am5.Bullet.new(root, {
                sprite: container,
            });
        });

        pointSeries.data.setAll(mapData);

        // Add zoom controls
        const zoomControl = chart.set('zoomControl', am5map.ZoomControl.new(root, {
            x: am5.percent(95),
            centerX: am5.percent(100),
            y: am5.percent(50),
            centerY: am5.percent(50),
        }));

        // Style zoom buttons
        zoomControl.plusButton.setAll({
            background: am5.RoundedRectangle.new(root, {
                fill: am5.color(0x9945FF),
                fillOpacity: 0.8,
            }),
            cursorOverStyle: 'pointer',
        });

        zoomControl.minusButton.setAll({
            background: am5.RoundedRectangle.new(root, {
                fill: am5.color(0x9945FF),
                fillOpacity: 0.8,
            }),
            cursorOverStyle: 'pointer',
        });

        // Enable mouse wheel zoom
        chart.chartContainer.set('wheelable', true);

        // Set zoom limits
        chart.set('maxZoomLevel', 8);
        chart.set('minZoomLevel', 1);

        // Auto-rotate
        chart.animate({
            key: 'rotationX',
            from: 0,
            to: 360,
            duration: 120000,
            loops: Infinity,
        });

        chart.set('rotationX', -20);
        chart.set('rotationY', -20);

        chart.appear(1000, 100);

        return () => {
            root.dispose();
        };
    }, [mapData]);

    return (
        <div className={`relative ${className} bg-[#0a0e1a] rounded-lg overflow-hidden`}>
            <div ref={chartRef} style={{ width: '100%', height: '100%' }} />

            {/* Stats Overlay - Left */}
            <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-sm px-6 py-4 rounded-lg border border-gray-800">
                <div className="space-y-3">
                    <div>
                        <div className="text-gray-400 text-xs">Total Nodes</div>
                        <div className="text-white text-3xl font-bold">80</div>
                    </div>
                    <div>
                        <div className="text-gray-400 text-xs">Online Nodes</div>
                        <div className="text-green-400 text-2xl font-bold">60</div>
                    </div>
                    <div>
                        <div className="text-gray-400 text-xs">Accessible Nodes</div>
                        <div className="text-cyan-400 text-2xl font-bold">36</div>
                    </div>
                    <div>
                        <div className="text-gray-400 text-xs">Countries</div>
                        <div className="text-white text-2xl font-bold">16</div>
                    </div>
                </div>
            </div>

            {/* Node Distribution - Top Right */}
            <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-sm px-4 py-3 rounded-lg border border-gray-800">
                <div className="text-white text-sm font-semibold mb-2">Node Distribution</div>
                <div className="space-y-1 text-xs">
                    <div className="flex items-center justify-between gap-8">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                            <span className="text-gray-300">Agents</span>
                        </div>
                        <span className="text-white font-mono">32</span>
                    </div>
                    <div className="flex items-center justify-between gap-8">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            <span className="text-gray-300">Trades</span>
                        </div>
                        <span className="text-white font-mono">40</span>
                    </div>
                    <div className="flex items-center justify-between gap-8">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-cyan-500"></div>
                            <span className="text-gray-300">Services</span>
                        </div>
                        <span className="text-white font-mono">8</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
