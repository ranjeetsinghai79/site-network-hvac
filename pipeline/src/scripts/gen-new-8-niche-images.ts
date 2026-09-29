/**
 * Generate hero + service images for the 8 new niche templates.
 * Run from monorepo root:
 *   cd pipeline && node --env-file=.env --import=tsx/esm src/scripts/gen-new-8-niche-images.ts [niche...]
 */
import { fal } from '@fal-ai/client'
import fs from 'fs'
import path from 'path'

const FAL_KEY = process.env.FAL_KEY!
const NEG = 'cartoon, illustration, 3D render, CGI, text overlay, watermark, blurry, low quality, distorted, oversaturated, unrealistic, extra limbs, logo, icon, badge, fake background, stock photo watermark'

type Niche =
  | 'plumbing' | 'tree-services' | 'landscaping' | 'pressure-washing'
  | 'foundation-repair' | 'basement-waterproofing' | 'epoxy-flooring' | 'septic-services'

const SHOTS: Record<Niche, { file: string; prompt: string; size?: 'portrait_4_3' | 'landscape_16_9' | 'square_hd' }[]> = {
  plumbing: [
    {
      file: 'hero-1.jpg',
      size: 'landscape_16_9',
      prompt: 'Licensed plumber in clean blue uniform and tool belt smiling confidently in a modern bright kitchen, crouching near under-sink cabinet with professional tools, suburban California home, cinematic natural daylight, photorealistic, 8K, no text',
    },
    {
      file: 'about-1.jpg',
      size: 'landscape_16_9',
      prompt: 'Small family-owned plumbing company team of four technicians in matching blue uniforms standing proudly in front of branded white service van, sunny California residential neighborhood, warm smiling faces, professional and approachable, photorealistic, 8K, no text',
    },
    {
      file: 'service-1.jpg',
      size: 'landscape_16_9',
      prompt: 'Professional plumber snaking a clogged drain in a clean modern bathroom sink, professional tool in hand, bright bathroom, photorealistic, 8K, no text',
    },
    {
      file: 'service-2.jpg',
      size: 'landscape_16_9',
      prompt: 'Licensed plumber installing a new tankless water heater in a utility room, copper pipe connections, professional work, clean garage setting, photorealistic, 8K, no text',
    },
    {
      file: 'service-3.jpg',
      size: 'landscape_16_9',
      prompt: 'Emergency plumber repairing a burst water pipe under a kitchen sink, water shut-off valve, professional work, bright kitchen cabinet interior, photorealistic, 8K, no text',
    },
    {
      file: 'service-4.jpg',
      size: 'landscape_16_9',
      prompt: 'Plumber soldering copper pipe joints during whole-house repiping, wall cavity open, professional torch and fittings, clean residential interior, photorealistic, 8K, no text',
    },
    {
      file: 'service-5.jpg',
      size: 'landscape_16_9',
      prompt: 'Plumber installing toilet and shower rough-in plumbing during bathroom remodel, white porcelain fixtures, professional tools, bright newly tiled bathroom, photorealistic, 8K, no text',
    },
    {
      file: 'service-6.jpg',
      size: 'landscape_16_9',
      prompt: 'Plumber performing gas line pressure test with gauge attached to residential gas line, professional safety gear, clean utility space, photorealistic, 8K, no text',
    },
  ],

  'tree-services': [
    {
      file: 'hero-1.jpg',
      size: 'landscape_16_9',
      prompt: 'ISA-certified arborist in full safety gear — hard hat, harness, chainsaw — high up in a massive oak tree on a sunny suburban California day, professional tree climber at work, cinematic wide angle, photorealistic, 8K, no text',
    },
    {
      file: 'about-1.jpg',
      size: 'landscape_16_9',
      prompt: 'Professional tree service company owner and his crew of three standing on a manicured green lawn after completing a successful tree removal, chainsaws and ropes in hand, branded work shirts, confident team photo, sunny California day, photorealistic, 8K, no text',
    },
    {
      file: 'service-1.jpg',
      size: 'landscape_16_9',
      prompt: 'Professional tree removal crew sectioning and rigging a large oak tree with ropes in suburban backyard, crane nearby, safety cones, professional arborist team, photorealistic, 8K, no text',
    },
    {
      file: 'service-2.jpg',
      size: 'landscape_16_9',
      prompt: 'Arborist trimming overgrown branches with professional chainsaw from an aerial lift bucket truck, tall residential tree, sunny day, clean cut branches, photorealistic, 8K, no text',
    },
    {
      file: 'service-3.jpg',
      size: 'landscape_16_9',
      prompt: 'Stump grinder machine pulverizing a large oak stump in suburban yard, wood chips flying, operator with safety glasses, clean residential lawn, photorealistic, 8K, no text',
    },
    {
      file: 'service-4.jpg',
      size: 'landscape_16_9',
      prompt: 'Emergency tree service crew removing a large storm-fallen tree from a house roof, chain saws and ropes, professional team with safety equipment, photorealistic, 8K, no text',
    },
    {
      file: 'service-5.jpg',
      size: 'landscape_16_9',
      prompt: 'Arborist using deep root fertilization equipment, injecting nutrients around base of large mature oak tree in California suburban yard, green lawn, photorealistic, 8K, no text',
    },
    {
      file: 'service-6.jpg',
      size: 'landscape_16_9',
      prompt: 'Professional tree planting — worker lowering young ornamental tree into prepared hole in residential yard, burlap root ball, fresh soil, sunny day, photorealistic, 8K, no text',
    },
  ],

  landscaping: [
    {
      file: 'hero-1.jpg',
      size: 'landscape_16_9',
      prompt: 'Professional landscaping crew of three transforming a suburban front yard, planting ornamental shrubs and colorful flowers, raking fresh mulch, green lawn, sunny California day, photorealistic, 8K, no text',
    },
    {
      file: 'about-1.jpg',
      size: 'landscape_16_9',
      prompt: 'Landscaping company owner in polo shirt kneeling in a beautifully designed garden he just completed, mature ornamental grasses and colorful perennials surrounding him, warm afternoon golden light, California suburban backyard, proud craftsman, photorealistic, 8K, no text',
    },
    {
      file: 'service-1.jpg',
      size: 'landscape_16_9',
      prompt: 'Professional lawn care worker mowing a pristine green suburban lawn with commercial zero-turn mower, striped pattern, clean edging along driveway, bright sunny day, photorealistic, 8K, no text',
    },
    {
      file: 'service-2.jpg',
      size: 'landscape_16_9',
      prompt: 'Landscape designer installing colorful seasonal flower bed in front yard, planting mixed petunias and lavender along stone path, mulched borders, California home, photorealistic, 8K, no text',
    },
    {
      file: 'service-3.jpg',
      size: 'landscape_16_9',
      prompt: 'Irrigation technician installing drip irrigation system in garden bed, laying soaker hose and emitters around shrubs, professional tools, suburban yard, photorealistic, 8K, no text',
    },
    {
      file: 'service-4.jpg',
      size: 'landscape_16_9',
      prompt: 'Sod installation crew rolling out fresh green Kentucky bluegrass sod in a bare residential backyard, workers kneeling and cutting sod to fit edges, photorealistic, 8K, no text',
    },
    {
      file: 'service-5.jpg',
      size: 'landscape_16_9',
      prompt: 'Landscaper spreading dark mulch in a professionally designed garden bed around mature shrubs, wheelbarrow, sunny residential yard, fresh clean look, photorealistic, 8K, no text',
    },
    {
      file: 'service-6.jpg',
      size: 'landscape_16_9',
      prompt: 'Beautiful completed landscape renovation of suburban home front yard — lush green lawn, neatly trimmed hedges, colorful flower borders, stone walkway, sprinklers running, photorealistic, 8K, no text',
    },
  ],

  'pressure-washing': [
    {
      file: 'hero-1.jpg',
      size: 'landscape_16_9',
      prompt: 'Professional pressure washer operator in safety goggles blasting concrete driveway with commercial hot-water pressure washer, dramatic high-pressure water spray, dramatic before-after line showing clean vs dirty concrete, suburban home, photorealistic, 8K, no text',
    },
    {
      file: 'about-1.jpg',
      size: 'landscape_16_9',
      prompt: 'Pressure washing business owner in company polo shirt smiling and holding pressure wash wand next to his professional trailer-mounted hot-water pressure washer rig, clean suburban driveway they just cleaned in background, sunny day, photorealistic, 8K, no text',
    },
    {
      file: 'service-1.jpg',
      size: 'landscape_16_9',
      prompt: 'Driveway pressure washing — dramatic transformation showing half clean, half dirty concrete driveway, commercial pressure washer in frame, photorealistic, 8K, no text',
    },
    {
      file: 'service-2.jpg',
      size: 'landscape_16_9',
      prompt: 'Commercial building exterior pressure washing, worker on scaffold cleaning dirty stucco siding with high-pressure wand, white building becoming bright and clean, photorealistic, 8K, no text',
    },
    {
      file: 'service-3.jpg',
      size: 'landscape_16_9',
      prompt: 'Wood deck pressure cleaning, worker using surface cleaner attachment on weathered gray deck, revealing bright clean wood grain, before-after effect visible, photorealistic, 8K, no text',
    },
    {
      file: 'service-4.jpg',
      size: 'landscape_16_9',
      prompt: 'Soft wash roof cleaning — professional applying low-pressure chemical treatment to algae-stained clay tile roof, ladder, professional safety gear, California suburban home, photorealistic, 8K, no text',
    },
    {
      file: 'service-5.jpg',
      size: 'landscape_16_9',
      prompt: 'Commercial parking lot pressure washing, industrial ride-on scrubber cleaning large asphalt lot, bright clean lines emerging from dirty surface, photorealistic, 8K, no text',
    },
    {
      file: 'service-6.jpg',
      size: 'landscape_16_9',
      prompt: 'Fleet washing service, worker with pressure washer cleaning large commercial truck exterior in outdoor lot, soap suds, professional cleaning equipment, photorealistic, 8K, no text',
    },
  ],

  'foundation-repair': [
    {
      file: 'hero-1.jpg',
      size: 'landscape_16_9',
      prompt: 'Structural engineer in hard hat examining a cracked concrete foundation wall in a basement, using flashlight and clipboard, professional inspection gear, photorealistic, 8K, no text',
    },
    {
      file: 'about-1.jpg',
      size: 'landscape_16_9',
      prompt: 'Foundation repair company owner in hard hat and company shirt standing confidently outside a suburban home, shaking hands with satisfied homeowner on front porch, friendly professional interaction, California suburban neighborhood, photorealistic, 8K, no text',
    },
    {
      file: 'service-1.jpg',
      size: 'landscape_16_9',
      prompt: 'Foundation repair crew installing steel helical piers under house footing, excavation next to foundation, workers with hydraulic driver equipment, photorealistic, 8K, no text',
    },
    {
      file: 'service-2.jpg',
      size: 'landscape_16_9',
      prompt: 'Foundation contractor applying carbon fiber straps to bowing basement concrete block wall, professional installation, basement repair, photorealistic, 8K, no text',
    },
    {
      file: 'service-3.jpg',
      size: 'landscape_16_9',
      prompt: 'Mudjacking concrete lifting — drilling holes in sunken concrete driveway slab, injecting slurry to lift, suburban home, contractor at work, photorealistic, 8K, no text',
    },
    {
      file: 'service-4.jpg',
      size: 'landscape_16_9',
      prompt: 'Foundation crack repair — technician injecting epoxy resin into vertical crack in concrete basement wall with injection ports installed, photorealistic, 8K, no text',
    },
    {
      file: 'service-5.jpg',
      size: 'landscape_16_9',
      prompt: 'Crawl space encapsulation — worker in white Tyvek suit installing thick white vapor barrier under house floor joists in dirt crawl space, photorealistic, 8K, no text',
    },
    {
      file: 'service-6.jpg',
      size: 'landscape_16_9',
      prompt: 'Foundation waterproofing exterior — workers excavating alongside house foundation applying black rubberized waterproofing membrane to concrete wall, photorealistic, 8K, no text',
    },
  ],

  'basement-waterproofing': [
    {
      file: 'hero-1.jpg',
      size: 'landscape_16_9',
      prompt: 'Basement waterproofing specialist in branded uniform standing in clean dry finished basement, inspecting concrete block wall that has been waterproofed, professional assessment, photorealistic, 8K, no text',
    },
    {
      file: 'about-1.jpg',
      size: 'landscape_16_9',
      prompt: 'Basement waterproofing company team of three uniformed technicians standing in a beautifully finished dry basement they just waterproofed, beaming with pride, fresh white walls, clean sump pump system visible in corner, photorealistic, 8K, no text',
    },
    {
      file: 'service-1.jpg',
      size: 'landscape_16_9',
      prompt: 'Interior drain tile installation — workers breaking concrete floor along basement perimeter with jackhammer, laying perforated drain pipe in gravel channel, photorealistic, 8K, no text',
    },
    {
      file: 'service-2.jpg',
      size: 'landscape_16_9',
      prompt: 'Exterior foundation waterproofing — workers applying thick black rubberized membrane to excavated concrete foundation wall, drainage board being installed, photorealistic, 8K, no text',
    },
    {
      file: 'service-3.jpg',
      size: 'landscape_16_9',
      prompt: 'Sump pump installation in basement corner pit, professional plumber lowering submersible pump into sump basin, battery backup unit visible, clean basement floor, photorealistic, 8K, no text',
    },
    {
      file: 'service-4.jpg',
      size: 'landscape_16_9',
      prompt: 'Crawl space encapsulation completed — bright clean white 20-mil vapor barrier covering entire dirt floor and walls of crawl space, dehumidifier unit installed, photorealistic, 8K, no text',
    },
    {
      file: 'service-5.jpg',
      size: 'landscape_16_9',
      prompt: 'Basement window well drain installation — worker digging gravel drainage channel around metal window well, installing drain cover, suburban home, photorealistic, 8K, no text',
    },
    {
      file: 'service-6.jpg',
      size: 'landscape_16_9',
      prompt: 'Emergency basement water extraction — industrial water pump removing standing water from flooded basement, worker with wet vac, documentation in progress, photorealistic, 8K, no text',
    },
  ],

  'epoxy-flooring': [
    {
      file: 'hero-1.jpg',
      size: 'landscape_16_9',
      prompt: 'Epoxy flooring installer using large squeegee spreading metallic silver epoxy coating across clean garage floor, dramatic reflection, professional garage setting, cinematic wide angle, photorealistic, 8K, no text',
    },
    {
      file: 'about-1.jpg',
      size: 'landscape_16_9',
      prompt: 'Epoxy flooring business owner kneeling and admiring the stunning metallic bronze and charcoal epoxy floor finish he just completed in a three-car residential garage, floor reflection is perfect, proud craftsman, natural daylight, photorealistic, 8K, no text',
    },
    {
      file: 'service-1.jpg',
      size: 'landscape_16_9',
      prompt: 'Stunning completed three-car garage floor with full-broadcast blue and gray color flake polyurea coating, gleaming metallic sheen, clean two cars parked on it, photorealistic, 8K, no text',
    },
    {
      file: 'service-2.jpg',
      size: 'landscape_16_9',
      prompt: 'Upscale commercial showroom with stunning swirled silver and charcoal metallic epoxy floor, luxury cars on display, dramatic showroom lighting, photorealistic, 8K, no text',
    },
    {
      file: 'service-3.jpg',
      size: 'landscape_16_9',
      prompt: 'Industrial warehouse floor with seamless gray epoxy coating, forklift driving on it, heavy equipment, bright warehouse lighting, highly durable surface, photorealistic, 8K, no text',
    },
    {
      file: 'service-4.jpg',
      size: 'landscape_16_9',
      prompt: 'Epoxy contractor using commercial diamond grinder to prepare concrete garage floor before coating, grinding sparks, professional equipment, safety glasses and ear protection, photorealistic, 8K, no text',
    },
    {
      file: 'service-5.jpg',
      size: 'landscape_16_9',
      prompt: 'Worker using roller to apply polyurea base coat to concrete garage floor, smooth even application, bright garage, professional floor coating process, photorealistic, 8K, no text',
    },
    {
      file: 'service-6.jpg',
      size: 'landscape_16_9',
      prompt: 'Beautiful finished marble-effect metallic epoxy floor in a luxurious home basement bar area, warm ambient lighting, bar stools, stunning floor reflection, photorealistic, 8K, no text',
    },
  ],

  'septic-services': [
    {
      file: 'hero-1.jpg',
      size: 'landscape_16_9',
      prompt: 'Licensed septic contractor in branded uniform kneeling beside open residential septic tank lid in suburban yard, professional pump-out truck with hose in background, sunny California day, photorealistic, 8K, no text',
    },
    {
      file: 'about-1.jpg',
      size: 'landscape_16_9',
      prompt: 'Family-owned septic service company owner and son in matching branded uniforms standing beside their professional vacuum truck on a rural California residential driveway, proud father-son team, sunny day, warm and trustworthy, photorealistic, 8K, no text',
    },
    {
      file: 'service-1.jpg',
      size: 'landscape_16_9',
      prompt: 'Septic tank pumping truck with heavy-duty vacuum hose connected to open residential concrete septic tank in backyard, professional operator in uniform, suburban home visible, photorealistic, 8K, no text',
    },
    {
      file: 'service-2.jpg',
      size: 'landscape_16_9',
      prompt: 'Septic system inspector using electronic locator to find tank lid location in residential yard, holding written inspection report on clipboard, professional gear, photorealistic, 8K, no text',
    },
    {
      file: 'service-3.jpg',
      size: 'landscape_16_9',
      prompt: 'Emergency septic pumping at dusk, service truck arriving at suburban home with lights, technician unrolling hose, urgency in scene, professional crew, photorealistic, 8K, no text',
    },
    {
      file: 'service-4.jpg',
      size: 'landscape_16_9',
      prompt: 'Drain field installation — excavator digging trenches in residential yard, workers laying perforated leach field pipe in gravel bed, new septic system installation, photorealistic, 8K, no text',
    },
    {
      file: 'service-5.jpg',
      size: 'landscape_16_9',
      prompt: 'Septic line hydro-jetting — technician feeding high-pressure water jetting hose into septic clean-out access port, professional equipment, residential yard, photorealistic, 8K, no text',
    },
    {
      file: 'service-6.jpg',
      size: 'landscape_16_9',
      prompt: 'Septic system riser installation — worker installing plastic riser rings on concrete septic tank to bring access to grade level, lid being fitted, suburban backyard, photorealistic, 8K, no text',
    },
  ],
}

const ALL_NICHES: Niche[] = [
  'plumbing', 'tree-services', 'landscaping', 'pressure-washing',
  'foundation-repair', 'basement-waterproofing', 'epoxy-flooring', 'septic-services',
]

async function generate(prompt: string, seed: number, size: string): Promise<Buffer | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await fal.subscribe('fal-ai/flux-pro/v1.1', {
        input: {
          prompt,
          negative_prompt: NEG,
          image_size: size,
          num_inference_steps: 28,
          guidance_scale: 3.5,
          num_images: 1,
          seed,
          safety_tolerance: '5',
        } as any,
      }) as any
      const url: string = result?.data?.images?.[0]?.url
      if (!url) continue
      const res = await fetch(url, { signal: AbortSignal.timeout(60_000) })
      if (!res.ok) continue
      return Buffer.from(await res.arrayBuffer())
    } catch (e) {
      console.error(`  attempt ${attempt + 1} failed:`, (e as Error).message)
      if (attempt < 2) await new Promise(r => setTimeout(r, 2000))
    }
  }
  return null
}

async function main() {
  if (!FAL_KEY) { console.error('FAL_KEY not set in env'); process.exit(1) }
  fal.config({ credentials: FAL_KEY })

  const args = process.argv.slice(2)
  const targets: Niche[] = args.length > 0
    ? args.filter(a => ALL_NICHES.includes(a as Niche)) as Niche[]
    : [...ALL_NICHES]

  if (targets.length === 0) {
    console.error('No valid niches specified. Valid:', ALL_NICHES.join(', '))
    process.exit(1)
  }

  console.log(`Generating images for: ${targets.join(', ')}`)
  const scriptDir = new URL('.', import.meta.url).pathname
  const templatesRoot = path.resolve(scriptDir, '../../..', 'templates')

  for (const niche of targets) {
    const outDir = path.join(templatesRoot, niche, 'public')
    const shots = SHOTS[niche]
    console.log(`\n=== ${niche} (${shots.length} images) → ${outDir} ===`)
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

    for (let i = 0; i < shots.length; i++) {
      const shot = shots[i]
      const outPath = path.join(outDir, shot.file)
      const size = shot.size ?? 'landscape_16_9'
      const seed = 73000 + ALL_NICHES.indexOf(niche) * 100 + i

      if (fs.existsSync(outPath)) {
        const stat = fs.statSync(outPath)
        if (stat.size > 50_000) {
          console.log(`  [${i+1}/${shots.length}] ${shot.file} — exists (${Math.round(stat.size/1024)}KB), skip`)
          continue
        }
      }

      process.stdout.write(`  [${i+1}/${shots.length}] ${shot.file} (${size})... `)
      const buf = await generate(shot.prompt, seed, size)
      if (buf) {
        fs.writeFileSync(outPath, buf)
        console.log(`✓ ${Math.round(buf.length/1024)}KB`)
      } else {
        console.log('FAILED')
      }
    }
  }
  console.log('\nDone.')
}

main().catch(console.error)
