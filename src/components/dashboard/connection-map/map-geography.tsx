"use client";

import { memo } from "react";
import { Geographies, Geography } from "react-simple-maps";
import geoData from "@/data/world-50m.json";
import { type MapColors, countToFill } from "./use-map-colors";
import { numericToAlpha2 } from "./country-codes";

interface MapGeographyProps {
  countryTotals: Record<string, number>;
  colors: MapColors;
  hoveredGeo: string | null;
  onHover: (id: string, name: string, count: number) => void;
  onLeave: () => void;
}

function getCountryId(geo: { properties: Record<string, unknown>; id?: string }): string {
  // Some TopoJSON sources include ISO_A2 directly in properties
  const alpha2 = (geo.properties.ISO_A2 ?? geo.properties.iso_a2) as string | undefined;
  if (alpha2 && alpha2 !== "-99") return alpha2;
  // Fall back: convert numeric ISO 3166-1 ID to alpha-2
  const numId = String(geo.id ?? "");
  return numericToAlpha2[numId] ?? numId;
}

function getCountryName(geo: { properties: Record<string, unknown> }): string {
  return (
    (geo.properties.NAME as string) ??
    (geo.properties.name as string) ??
    ""
  );
}

export const MapGeography = memo(function MapGeography({
  countryTotals,
  colors,
  hoveredGeo,
  onHover,
  onLeave,
}: MapGeographyProps) {
  return (
    <Geographies geography={geoData}>
      {({ geographies }) =>
        geographies.map((geo) => {
          const id = getCountryId(geo);
          const name = getCountryName(geo);
          const count = countryTotals[id] || 0;
          const isHovered = hoveredGeo === id;
          const fill = isHovered && count > 0
            ? colors.hoverFill
            : countToFill(count, colors);

          return (
            <Geography
              key={geo.rsmKey}
              geography={geo}
              fill={fill}
              stroke={colors.border}
              strokeWidth={isHovered ? 1.2 : 0.5}
              style={{
                default: { outline: "none" },
                hover: { outline: "none" },
                pressed: { outline: "none" },
              }}
              onMouseEnter={() => {
                if (count > 0) onHover(id, name, count);
              }}
              onMouseLeave={onLeave}
            />
          );
        })
      }
    </Geographies>
  );
});
