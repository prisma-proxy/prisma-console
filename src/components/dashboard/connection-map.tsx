"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { ComposableMap } from "react-simple-maps";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { MOCK_GEO_DATA, MOCK_SERVER_GEO } from "@/lib/mock-geo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/loading-placeholder";
import { Globe, Plus, Minus, RotateCcw } from "lucide-react";
import { useMapColors } from "./connection-map/use-map-colors";
import { MapGeography } from "./connection-map/map-geography";
import { CityMarkers, ServerMarker } from "./connection-map/map-markers";
import { MapTooltip } from "./connection-map/map-tooltip";
import { MapLegend } from "./connection-map/map-legend";

const BASE_SCALE = 250;
const MIN_SCALE = 200;
const MAX_SCALE = 600;

export function ConnectionMap() {
  const { t } = useI18n();
  const colors = useMapColors();
  const containerRef = useRef<HTMLDivElement>(null);

  // Tooltip state
  const [tooltipContent, setTooltipContent] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [hoveredGeo, setHoveredGeo] = useState<string | null>(null);
  const [hoveredCity, setHoveredCity] = useState<string | null>(null);

  // Globe rotation: [lambda, phi, gamma] — longitude, latitude, roll
  const [rotation, setRotation] = useState<[number, number, number]>([0, -20, 0]);
  const [scale, setScale] = useState(BASE_SCALE);

  // Drag state
  const dragRef = useRef<{ x: number; y: number; rot: [number, number, number] } | null>(null);

  const { data: rawGeo } = useQuery({
    queryKey: ["connections-geo"],
    queryFn: () => api.getConnectionGeo(),
    refetchInterval: 15000,
  });

  const { data: rawServerGeo } = useQuery({
    queryKey: ["server-geo"],
    queryFn: () => api.getServerGeo(),
    staleTime: 5 * 60 * 1000,
  });

  const isDev = process.env.NODE_ENV === "development";
  const geo = rawGeo && rawGeo.length > 0 ? rawGeo : isDev ? MOCK_GEO_DATA : rawGeo;
  const serverGeo = rawServerGeo ?? (isDev ? MOCK_SERVER_GEO : null);

  const countryTotals = useMemo(() => {
    if (!geo) return {} as Record<string, number>;
    const m: Record<string, number> = {};
    for (const entry of geo) {
      m[entry.country] = (m[entry.country] || 0) + entry.count;
    }
    return m;
  }, [geo]);

  const cityEntries = useMemo(() => {
    if (!geo) return [];
    return geo.filter((e) => e.lat != null && e.lon != null);
  }, [geo]);

  const maxCityCount = useMemo(
    () => (cityEntries.length > 0 ? Math.max(...cityEntries.map((e) => e.count), 1) : 1),
    [cityEntries],
  );

  const totalConnections = useMemo(
    () => (geo ? geo.reduce((sum, g) => sum + g.count, 0) : 0),
    [geo],
  );

  const uniqueCountries = useMemo(
    () => Object.keys(countryTotals).length,
    [countryTotals],
  );

  const clearTooltip = useCallback(() => {
    setTooltipContent(null);
    setTooltipPos(null);
    setHoveredGeo(null);
    setHoveredCity(null);
  }, []);

  const handleGeoHover = useCallback((id: string, name: string, count: number) => {
    setHoveredGeo(id);
    setHoveredCity(null);
    setTooltipContent(`${name}: ${count} connection${count !== 1 ? "s" : ""}`);
  }, []);

  const handleCityHover = useCallback((key: string, label: string) => {
    setHoveredCity(key);
    setHoveredGeo(null);
    setTooltipContent(label);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });

    // Handle drag rotation
    if (dragRef.current) {
      const dx = e.clientX - dragRef.current.x;
      const dy = e.clientY - dragRef.current.y;
      const sensitivity = 0.3;
      // Longitude wraps infinitely — no clamping
      const newLambda = dragRef.current.rot[0] + dx * sensitivity;
      // Latitude clamped to ±90
      const newPhi = Math.max(-90, Math.min(90, dragRef.current.rot[1] - dy * sensitivity));
      setRotation([newLambda, newPhi, 0]);
    }
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Only start drag on the map area, not on controls
    if ((e.target as HTMLElement).closest("button")) return;
    dragRef.current = { x: e.clientX, y: e.clientY, rot: [...rotation] };
    e.preventDefault();
  }, [rotation]);

  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const handleZoomIn = useCallback(() => {
    setScale((s) => Math.min(s * 1.3, MAX_SCALE));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((s) => Math.max(s / 1.3, MIN_SCALE));
  }, []);

  const handleReset = useCallback(() => {
    setScale(BASE_SCALE);
    setRotation([0, -20, 0]);
  }, []);

  if (!geo || geo.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            {t("connectionMap.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={Globe}
            title={t("empty.noConnections")}
            description={t("empty.noConnectionsHint")}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">
          {t("connectionMap.title")}
        </CardTitle>
        <span className="text-xs font-medium text-muted-foreground">
          {totalConnections} {totalConnections === 1 ? "connection" : "connections"} from{" "}
          {uniqueCountries} {uniqueCountries === 1 ? "country" : "countries"}
        </span>
      </CardHeader>
      <CardContent>
        <div
          ref={containerRef}
          className="relative rounded-lg overflow-hidden border shadow-sm select-none"
          style={{
            backgroundColor: colors.ocean,
            cursor: dragRef.current ? "grabbing" : "grab",
          }}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            clearTooltip();
            dragRef.current = null;
          }}
        >
          {/* Zoom controls */}
          <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
            <Button
              size="icon"
              variant="outline"
              className="h-6 w-6 bg-background/90 hover:bg-background shadow-sm"
              onClick={handleZoomIn}
              disabled={scale >= MAX_SCALE}
            >
              <Plus className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="h-6 w-6 bg-background/90 hover:bg-background shadow-sm"
              onClick={handleZoomOut}
              disabled={scale <= MIN_SCALE}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="h-6 w-6 bg-background/90 hover:bg-background shadow-sm"
              onClick={handleReset}
              disabled={scale === BASE_SCALE && rotation[0] === 0 && rotation[1] === -20}
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          </div>

          <ComposableMap
            projection="geoOrthographic"
            projectionConfig={{
              scale,
              rotate: rotation,
              center: [0, 0],
            }}
            width={500}
            height={500}
            style={{ width: "100%", height: "auto" }}
          >
            {/* Globe sphere (ocean background) */}
            <circle
              cx={250}
              cy={250}
              r={scale}
              fill={colors.ocean}
              stroke={colors.border}
              strokeWidth={0.5}
            />

            <MapGeography
              countryTotals={countryTotals}
              colors={colors}
              hoveredGeo={hoveredGeo}
              onHover={handleGeoHover}
              onLeave={clearTooltip}
            />
            <CityMarkers
              cityEntries={cityEntries}
              maxCityCount={maxCityCount}
              colors={colors}
              hoveredCity={hoveredCity}
              onHover={handleCityHover}
              onLeave={clearTooltip}
            />
            <ServerMarker serverGeo={serverGeo} colors={colors} />
          </ComposableMap>

          <MapTooltip content={tooltipContent} position={tooltipPos} />
        </div>
        <MapLegend colors={colors} />
      </CardContent>
    </Card>
  );
}
