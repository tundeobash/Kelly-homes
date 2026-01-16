// lib/stylePrompts.ts
export const stylePrompts: Record<string, { positive: string; negative: string }> = {
  minimalist: {
    positive: `Redesign this room in a minimalist interior design style.

Design intent:
Minimalism emphasizes simplicity, clarity, and intentionality. Every element must serve a purpose. The space should feel calm, airy, and visually uncluttered, prioritizing quality over quantity.

Spatial layout:
Maintain an open, balanced, and breathable feel with generous negative space. Furniture placement should be sparse and deliberate. Avoid overcrowding, visual noise, and unnecessary objects.

Color palette:
Use a restrained neutral palette including white, off-white, soft cream, light grey, warm beige, and muted earth tones. Accents, if any, must be extremely subtle. Avoid bold colors, strong contrast, or busy patterns.

Materials and textures:
Use natural, refined materials with matte finishes such as light wood (oak, ash, birch), stone or concrete, linen, cotton, wool, and minimal brushed metal. Textures should add depth subtly without layering excessively.

Furniture:
Replace existing furniture with simple, clean-lined, low-profile modern pieces. Upholstery should be plain and neutral. Each furniture item must feel intentional and well-spaced. Avoid bulky, ornate, or decorative furniture.

Lighting:
Preserve natural light. Use soft, warm, integrated lighting such as recessed or linear fixtures. Lighting should be functional and understated, not decorative.

Decor:
Keep decor minimal and curated. Limit to one abstract artwork, one small indoor plant with a clean form, and a few simple ceramic objects. No clutter or collections.

Mandatory constraints:
- Keep the same room layout and architecture
- Do not change the camera angle
- Replace furniture only
- Photorealistic
- Realistic shadows and materials`,
    negative: `No warped geometry
No extra clutter
No decorative excess
No bold or saturated colors
No ornate or vintage furniture
No unrealistic lighting or reflections
No cartoon or stylized rendering
No text, logos, or watermarks`,
  },
}

export function getStylePrompt(style: string) {
  return stylePrompts[style.toLowerCase()] ?? null
}
  