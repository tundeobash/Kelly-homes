"use client"

import dynamic from "next/dynamic"

export const Stage = dynamic(() => import("react-konva").then((mod) => mod.Stage), { ssr: false })
export const Layer = dynamic(() => import("react-konva").then((mod) => mod.Layer), { ssr: false })
export const Image = dynamic(() => import("react-konva").then((mod) => mod.Image), { ssr: false })
export const Group = dynamic(() => import("react-konva").then((mod) => mod.Group), { ssr: false })
export const Rect = dynamic(() => import("react-konva").then((mod) => mod.Rect), { ssr: false })
export const Transformer = dynamic(() => import("react-konva").then((mod) => mod.Transformer), { ssr: false })
