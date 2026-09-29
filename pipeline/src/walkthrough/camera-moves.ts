/**
 * Room → cinematic camera move mapping (pattern from re-walkthrough-pro).
 * Each room type gets a motion prompt so stitched clips read like walking
 * through the home. Prompts are model-agnostic image-to-video directions.
 */

export type RoomType =
  | 'exterior'
  | 'entry'
  | 'living'
  | 'kitchen'
  | 'dining'
  | 'bedroom'
  | 'bathroom'
  | 'office'
  | 'hallway'
  | 'basement'
  | 'garage'
  | 'backyard'
  | 'pool'
  | 'view'
  | 'aerial'
  | 'other'

/** Stitch order — exterior in, rooms, outdoor finale. */
export const ROOM_ORDER: RoomType[] = [
  'aerial', 'exterior', 'entry', 'hallway', 'living', 'dining', 'kitchen',
  'office', 'bedroom', 'bathroom', 'basement', 'garage', 'view', 'backyard',
  'pool', 'other',
]

const SHARED_STYLE =
  'perfectly smooth cinematic motion, no camera shake, no people, no warping or morphing of walls and furniture, photorealistic, natural light'

export const CAMERA_MOVES: Record<RoomType, string> = {
  aerial:   `Slow aerial drone descent toward the property, revealing the home and surrounding landscape, golden hour light, ${SHARED_STYLE}`,
  exterior: `Slow drone approach toward the front of the house, gentle push-in as if arriving, subtle breeze in trees, ${SHARED_STYLE}`,
  entry:    `Slow steadicam push forward through the entryway as if stepping inside, gentle forward glide, ${SHARED_STYLE}`,
  hallway:  `Smooth steadicam walkthrough gliding forward down the hallway, eye-level, ${SHARED_STYLE}`,
  living:   `Slow cinematic orbit around the living room, revealing the space and furniture arrangement, ${SHARED_STYLE}`,
  dining:   `Slow lateral dolly across the dining area, table and fixtures in focus, ${SHARED_STYLE}`,
  kitchen:  `Slow lateral dolly along the kitchen island, countertops and appliances gleaming, ${SHARED_STYLE}`,
  office:   `Gentle push-in toward the desk and window, calm focused atmosphere, ${SHARED_STYLE}`,
  bedroom:  `Slow gentle push-in toward the bed and window, soft morning light, restful atmosphere, ${SHARED_STYLE}`,
  bathroom: `Slow reveal pan across the bathroom, light gleaming on tile and fixtures, ${SHARED_STYLE}`,
  basement: `Smooth steadicam glide forward through the finished basement space, ${SHARED_STYLE}`,
  garage:   `Slow lateral pan across the garage interior, clean and organized, ${SHARED_STYLE}`,
  view:     `Slow approach toward the window, revealing the view beyond, light streaming in, ${SHARED_STYLE}`,
  backyard: `Slow rising reveal over the backyard, lifting to show the full outdoor space, golden hour, ${SHARED_STYLE}`,
  pool:     `Slow glide over the pool water toward the house, gentle ripples, golden hour reflections, ${SHARED_STYLE}`,
  other:    `Slow gentle push-in revealing the space, ${SHARED_STYLE}`,
}

const FILENAME_KEYWORDS: Array<[RegExp, RoomType]> = [
  [/aerial|drone|birds?-?eye/i, 'aerial'],
  [/exterior|front|facade|curb/i, 'exterior'],
  [/entry|foyer|entrance/i, 'entry'],
  [/hall/i, 'hallway'],
  [/living|family|great-?room|lounge/i, 'living'],
  [/dining/i, 'dining'],
  [/kitchen/i, 'kitchen'],
  [/office|study|den/i, 'office'],
  [/bed|master|primary/i, 'bedroom'],
  [/bath|shower|ensuite/i, 'bathroom'],
  [/basement/i, 'basement'],
  [/garage/i, 'garage'],
  [/view|window|balcony/i, 'view'],
  [/backyard|back-?yard|patio|deck|garden|yard/i, 'backyard'],
  [/pool|spa/i, 'pool'],
]

/** Infer room type from a photo filename, e.g. "03-kitchen.jpg" → kitchen. */
export function inferRoomType(filename: string): RoomType {
  for (const [re, room] of FILENAME_KEYWORDS) {
    if (re.test(filename)) return room
  }
  return 'other'
}
