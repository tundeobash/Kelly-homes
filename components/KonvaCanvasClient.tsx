"use client"

import dynamic from "next/dynamic"
import { ENABLE_KONVA } from "@/lib/featureFlags"

// Placeholder component when Konva is disabled
const KonvaDisabledPlaceholder = () => null

// Only import react-konva when the feature flag is enabled
export const Stage = ENABLE_KONVA
  ? dynamic(() => import("react-konva").then((mod) => mod.Stage), { ssr: false })
  : KonvaDisabledPlaceholder

export const Layer = ENABLE_KONVA
  ? dynamic(() => import("react-konva").then((mod) => mod.Layer), { ssr: false })
  : KonvaDisabledPlaceholder

export const Image = ENABLE_KONVA
  ? dynamic(() => import("react-konva").then((mod) => mod.Image), { ssr: false })
  : KonvaDisabledPlaceholder

export const Group = ENABLE_KONVA
  ? dynamic(() => import("react-konva").then((mod) => mod.Group), { ssr: false })
  : KonvaDisabledPlaceholder

export const Rect = ENABLE_KONVA
  ? dynamic(() => import("react-konva").then((mod) => mod.Rect), { ssr: false })
  : KonvaDisabledPlaceholder

export const Transformer = ENABLE_KONVA
  ? dynamic(() => import("react-konva").then((mod) => mod.Transformer), { ssr: false })
  : KonvaDisabledPlaceholder
