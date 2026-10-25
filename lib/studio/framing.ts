/** The camera fits the object into the space left by visible controls. */
export function sceneFrame(width: number, height: number, options: {
  gallery?: boolean; contextPanel?: 'part' | 'inspector' | 'dialogue' | null; partsOpen?: boolean; bottomInset?: number; mechanism?: boolean;
} = {}) {
  const phone = width <= 600;
  let left = phone ? 49 : options.partsOpen ? 325 : 85;
  let right = phone ? 22 : width > 900 && options.contextPanel ? options.contextPanel === 'inspector' ? 390 : 340 : 65;
  let top = options.mechanism ? 125 : 155;
  let bottom = Math.min(options.bottomInset ?? 175, height * (options.mechanism ? .68 : .56));
  if (phone && options.contextPanel === 'part') bottom = Math.min(360, height * .49);
  if (options.gallery) {
    left = phone ? 45 : width * .45;
    right = phone ? 20 : width * .055;
    top = phone ? Math.min(285, height * .39) : 70;
    bottom = phone ? Math.max(80, height - 435) : width > 900 ? 225 : 260;
  }
  if(phone&&options.contextPanel==='dialogue')top=275;
  top = Math.min(top, height * .43);
  bottom = Math.min(bottom, height - top - 100);
  right = Math.min(right, width - left - 140);
  return { left, right: Math.max(12, right), top, bottom: Math.max(40, bottom) };
}
