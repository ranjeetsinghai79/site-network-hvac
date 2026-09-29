/**
 * Generate niche image library using OpenAI gpt-image-1 (highest quality available).
 * One-time run per niche — images saved to pipeline/assets/<niche>/ and reused forever.
 *
 * Usage:
 *   npx tsx src/scripts/gen-niche-library-openai.ts              # all niches
 *   NICHE=medspa npx tsx src/scripts/gen-niche-library-openai.ts  # one niche
 *   NICHE=medspa SKIP_EXISTING=true npx tsx ...                   # skip already generated
 *
 * Cost: ~$0.25/image (high quality 1536x1024). 6 images × 25 niches = ~$37.50 total.
 * Set QUALITY=medium to cut cost to ~$0.063/image (~$9.45 total).
 */

import fs from 'fs'
import path from 'path'

const OPENAI_KEY   = process.env.OPENAI_API_KEY!
const QUALITY      = (process.env.QUALITY ?? 'high') as 'low' | 'medium' | 'high'
const SKIP_EXISTING = process.env.SKIP_EXISTING !== 'false'
const ASSETS_DIR   = path.resolve(__dirname, '../../assets')

if (!OPENAI_KEY) {
  console.error('Missing OPENAI_API_KEY in env')
  process.exit(1)
}

// Price per image (USD) by quality × size
const PRICE = { low: 0.016, medium: 0.063, high: 0.25 }

type Shot = { file: string; prompt: string; size?: 'landscape' | 'portrait' | 'square' }

// 6 shots per niche — hero (landscape) + service/detail shots (portrait)
const LIBRARY: Record<string, Shot[]> = {
  medspa: [
    { file: 'hero-bg.jpg',      size: 'landscape', prompt: 'Ultra-luxury medical spa interior — white marble reception desk with single white orchid, warm champagne pendant lighting, floor-to-ceiling frosted glass panels, minimalist stone feature wall, tranquil premium atmosphere, photorealistic 8K architectural photography, no text, no people' },
    { file: 'hero-1.jpg',       size: 'portrait',  prompt: 'Elegant beautiful woman in her early 30s receiving luxury hydrafacial treatment at premium medical spa — eyes peacefully closed, certified aesthetician in crisp white clinical uniform applying diamond-tip microdermabrasion device, soft diffused studio lighting from above, cream linen treatment bed, photorealistic 8K beauty photography, no text' },
    { file: 'hero-2.jpg',       size: 'portrait',  prompt: 'Stunning close-up of radiant glowing dewy skin on beautiful woman after luxury medspa facial — porcelain complexion, natural translucent glow, soft white background, shallow depth of field with beautiful bokeh, professional beauty editorial photography, photorealistic 8K, no text' },
    { file: 'hero-3.jpg',       size: 'portrait',  prompt: 'Confident female aesthetician in luxury medspa — pristine white lab coat, holding premium skincare serum, standing in elegant treatment room with soft gold ambient lighting, marble countertop with curated luxury skincare products, warm professional smile, photorealistic 8K portrait photography, no text' },
    { file: 'treatment.jpg',    size: 'landscape', prompt: 'Luxurious medspa treatment room — cream and gold color palette, LED treatment bed with heated blanket, tray of diamond facial tools and serums, fresh white roses in bud vase, soft warm window light, immaculate and serene, wide angle interior photography, photorealistic 8K, no text, no people' },
    { file: 'before-after.jpg', size: 'landscape', prompt: 'Split diptych before-and-after skin transformation — left: dull uneven skin tone, right: the same face with luminous even glowing complexion after medspa treatment, clinical neutral background, professional beauty photography lighting, photorealistic 8K, no text labels, no watermark' },
  ],

  'skin-clinic': [
    { file: 'hero-bg.jpg',   size: 'landscape', prompt: 'Modern clinical aesthetic skin clinic interior — clean white walls with subtle lighting, sleek treatment stations, professional LED light therapy equipment, minimalist elegant design, warm cream and white palette, photorealistic 8K architectural photography, no text, no people' },
    { file: 'hero-1.jpg',    size: 'portrait',  prompt: 'Beautiful woman receiving advanced LED light therapy at premium skin clinic — reclining comfortably, glowing amber light illuminating her serene face, aesthetician in medical uniform nearby, clinical luxury environment, photorealistic 8K, no text' },
    { file: 'hero-2.jpg',    size: 'portrait',  prompt: 'Flawless radiant skin close-up — young woman with perfect dewy glass skin complexion after advanced clinical skin treatment, soft studio lighting, white background, professional beauty editorial photography, photorealistic 8K, no text' },
    { file: 'hero-3.jpg',    size: 'portrait',  prompt: 'Professional female skin care specialist in white clinical coat using advanced ultrasound skin device on client face, modern skin clinic treatment room, focused professional expression, clinical yet warm atmosphere, photorealistic 8K, no text' },
    { file: 'clinic.jpg',    size: 'landscape', prompt: 'Premium skin clinic treatment area — state-of-the-art laser equipment, clean clinical white surfaces, organized skincare product display, professional lighting panels, sterile yet welcoming, photorealistic 8K interior photography, no text, no people' },
    { file: 'results.jpg',   size: 'portrait',  prompt: 'Stunning skin transformation result — beautiful woman with luminous even porcelain skin, happy confident expression, soft natural light, before-after improvement visible in glowing complexion, professional beauty photography, photorealistic 8K, no text' },
  ],

  'iv-therapy': [
    { file: 'hero-bg.jpg', size: 'landscape', prompt: 'Luxury IV therapy lounge — premium leather recliner chairs in individual pods, soft ambient lighting, modern clean clinical aesthetic, warm wood accents, calming spa-like atmosphere, photorealistic 8K interior photography, no text, no people' },
    { file: 'hero-1.jpg',  size: 'portrait',  prompt: 'Relaxed fit woman receiving IV drip therapy in luxury wellness lounge — reclining in plush leather chair, clear IV bag with golden saline solution, nurse in navy uniform attentively adjusting drip, calm serene expression, soft warm lighting, photorealistic 8K, no text' },
    { file: 'hero-2.jpg',  size: 'portrait',  prompt: 'Close-up of premium IV therapy bag with vitamins and minerals dripping into clear tubing, clinical clean setup, luxury medical spa background softly blurred with warm bokeh, photorealistic 8K macro product photography, no text' },
    { file: 'hero-3.jpg',  size: 'portrait',  prompt: 'Certified nurse practitioner in luxury IV wellness clinic — professional navy scrubs, warm confident smile, modern clinical lounge visible behind, professional medical portrait photography, photorealistic 8K, no text' },
    { file: 'drips.jpg',   size: 'landscape', prompt: 'Premium IV drip menu display — elegant backlit display showing Myers Cocktail, NAD+, Immune Boost, Hangover Recovery, Beauty Glow drips in individual glass vials with color-coded labels, clean minimalist clinical product photography, photorealistic 8K, no text overlays' },
    { file: 'lounge.jpg',  size: 'landscape', prompt: 'Modern IV therapy lounge interior — row of premium leather recliners each with personal IV stand, soft individual lighting, serene spa atmosphere, potted greenery accents, clients relaxing peacefully, wide angle interior, photorealistic 8K, no text' },
  ],

  salon: [
    { file: 'hero-bg.jpg', size: 'landscape', prompt: 'Chic modern hair salon interior — sleek white stations with large illuminated mirrors, luxury styling chairs in warm champagne leather, subtle pendant lighting, fresh flowers, upscale boutique atmosphere, wide angle photorealistic 8K interior photography, no text, no people' },
    { file: 'hero-1.jpg',  size: 'portrait',  prompt: 'Expert female hair stylist blow-drying clients gorgeous flowing hair in upscale salon — client smiling at mirror, golden warm lighting, professional styling tools, premium salon products visible on counter, photorealistic 8K, no text' },
    { file: 'hero-2.jpg',  size: 'portrait',  prompt: 'Beautiful woman with stunning balayage hair color — rich warm honey-blonde highlights, healthy glossy locks cascading over shoulder, clean white background, professional hair editorial photography, photorealistic 8K, no text' },
    { file: 'hero-3.jpg',  size: 'portrait',  prompt: 'Skilled colorist applying balayage highlights with professional brush at luxury hair salon — detail of artful technique, professional cape on client, warm salon lighting, premium products on station, photorealistic 8K, no text' },
    { file: 'salon.jpg',   size: 'landscape', prompt: 'Luxury hair salon reception and retail area — backlit retail shelves with premium hair care products, elegant reception desk, fresh floral arrangement, warm inviting atmosphere, photorealistic 8K architectural interior photography, no text, no people' },
    { file: 'result.jpg',  size: 'portrait',  prompt: 'Stunning hair transformation — woman with perfectly styled glossy bouncy blowout, confident radiant smile, professional studio backdrop, beauty editorial photography, photorealistic 8K, no text' },
  ],

  barbershop: [
    { file: 'hero-bg.jpg', size: 'landscape', prompt: 'Premium classic barbershop interior — vintage barber chairs in cognac leather with chrome details, antique mirror stations, subway tile, Edison bulb pendant lights, straight razor and premium grooming products displayed, warm masculine atmosphere, photorealistic 8K interior photography, no text, no people' },
    { file: 'hero-1.jpg',  size: 'portrait',  prompt: 'Expert barber in crisp black uniform giving precise skin fade haircut to client — focused professional technique visible, classic barbershop mirrors reflecting warm light, premium tools on station, photorealistic 8K, no text' },
    { file: 'hero-2.jpg',  size: 'portrait',  prompt: 'Handsome man with perfect fresh haircut and clean beard trim — confident masculine look, professional grooming result, studio backdrop, male grooming editorial photography, photorealistic 8K, no text' },
    { file: 'hero-3.jpg',  size: 'portrait',  prompt: 'Traditional hot towel straight razor shave in classic barbershop — barber applying warm lather, client reclined with eyes closed, steaming towel nearby, vintage grooming ritual, warm intimate lighting, photorealistic 8K, no text' },
    { file: 'shop.jpg',    size: 'landscape', prompt: 'Classic barbershop waiting area — leather sofa, vintage sports memorabilia on exposed brick wall, barber pole, warm Edison bulb lighting, masculine premium aesthetic, photorealistic 8K interior photography, no text, no people' },
    { file: 'tools.jpg',   size: 'landscape', prompt: 'Premium barbershop tools flat lay — professional clippers, straight razor, shaving brush, pomade, scissors arranged artfully on marble surface, warm studio lighting, luxury grooming product photography, photorealistic 8K, no text' },
  ],

  'nail-studio': [
    { file: 'hero-bg.jpg', size: 'landscape', prompt: 'Elegant modern nail studio interior — blush pink and white palette, marble nail stations with soft warm lighting, minimalist luxury design, fresh peonies in vase, premium gel polish display wall, photorealistic 8K architectural interior photography, no text, no people' },
    { file: 'hero-1.jpg',  size: 'portrait',  prompt: 'Skilled nail technician applying precision gel color on clients perfectly shaped nails — detail of expert technique, OPI luxury gel polish, pink marble nail station, blush studio lighting, photorealistic 8K beauty photography, no text' },
    { file: 'hero-2.jpg',  size: 'portrait',  prompt: 'Stunning nail art close-up — elegant hands with perfectly shaped almond nails in soft blush pink with delicate gold foil accents, white background, luxury nail editorial photography, photorealistic 8K macro, no text' },
    { file: 'hero-3.jpg',  size: 'portrait',  prompt: 'Beautiful woman receiving luxury pedicure — relaxed expression, feet in warm rose-petal spa bath, nail technician applying polish, premium pedicure chair, soft ambient lighting, photorealistic 8K, no text' },
    { file: 'polish.jpg',  size: 'landscape', prompt: 'Luxury gel polish collection display — premium OPI and Gelish bottles arranged beautifully in rainbow spectrum on marble shelf, soft studio lighting, beauty product photography, photorealistic 8K, no text' },
    { file: 'result.jpg',  size: 'portrait',  prompt: 'Perfect nail art showcase — elegant female hands with stunning chrome powder nail design on coffin-shaped nails, white background, macro beauty photography with beautiful bokeh, photorealistic 8K, no text' },
  ],

  hvac: [
    { file: 'hero-bg.jpg', size: 'landscape', prompt: 'Modern energy-efficient HVAC system installed on rooftop of suburban home — gleaming new Trane or Carrier unit on concrete pad, clean suburban neighborhood in background, bright clear day, photorealistic 8K architectural exterior photography, no text' },
    { file: 'hero-1.jpg',  size: 'portrait',  prompt: 'Professional HVAC technician in crisp navy uniform with company logo inspecting residential air conditioning unit — clipboard in hand, confident expert expression, suburban backyard, clear blue sky, photorealistic 8K, no text' },
    { file: 'hero-2.jpg',  size: 'portrait',  prompt: 'HVAC technician installing new smart thermostat in modern home interior — professional on ladder working precisely, clean modern walls, daylight interior setting, photorealistic 8K, no text' },
    { file: 'hero-3.jpg',  size: 'portrait',  prompt: 'Happy homeowner family smiling in comfortable cool living room with new HVAC system — summer day visible through window, modern home interior, warm family moment, photorealistic 8K, no text' },
    { file: 'unit.jpg',    size: 'landscape', prompt: 'Brand new high-efficiency HVAC outdoor condenser unit installed on concrete pad beside clean suburban home — professional installation with copper lines visible, neat cable management, photorealistic 8K, no text' },
    { file: 'furnace.jpg', size: 'portrait',  prompt: 'Modern high-efficiency gas furnace in clean utility room — Trane or Lennox unit, professional installation, PVC flue pipes, smart thermostat wire connections, photorealistic 8K, no text' },
  ],

  roofing: [
    { file: 'hero-bg.jpg', size: 'landscape', prompt: 'Stunning newly replaced roof on beautiful American home — premium architectural shingles in charcoal gray, perfect symmetrical installation, lush green landscaping, bright sunny day, photorealistic 8K architectural exterior photography, no text' },
    { file: 'hero-1.jpg',  size: 'portrait',  prompt: 'Expert roofing crew installing premium architectural shingles on residential home — professional roofers in safety harnesses on peaked roof, sunny day, suburban neighborhood visible, photorealistic 8K, no text' },
    { file: 'hero-2.jpg',  size: 'portrait',  prompt: 'Roofing contractor in company uniform standing proudly on completed roof installation — arms crossed, confident experienced expression, beautiful suburban home behind, bright day, photorealistic 8K portrait photography, no text' },
    { file: 'hero-3.jpg',  size: 'portrait',  prompt: 'Close-up of premium GAF or Owens Corning architectural shingles being installed — expert hand placement showing quality craftsmanship, dimensional shingle texture visible, photorealistic 8K macro, no text' },
    { file: 'damage.jpg',  size: 'landscape', prompt: 'Insurance roof damage assessment — roofing inspector examining hail-damaged shingles on residential roof, clipboard and drone visible, bright day assessment photo, photorealistic 8K, no text' },
    { file: 'result.jpg',  size: 'landscape', prompt: 'Beautiful curb appeal after new roof installation — immaculate new charcoal architectural shingle roof on traditional American home, perfect gutters, manicured lawn, proud homeowner visible in yard, photorealistic 8K, no text' },
  ],

  plumbing: [
    { file: 'hero-bg.jpg', size: 'landscape', prompt: 'Modern luxury bathroom with pristine plumbing fixtures — frameless glass shower, freestanding soaking tub, rainfall showerhead, matte black faucets, marble tile, warm ambient lighting, photorealistic 8K interior photography, no text, no people' },
    { file: 'hero-1.jpg',  size: 'portrait',  prompt: 'Professional plumber in branded uniform replacing modern kitchen faucet under sink — focused expert technique, clean organized tools on floor mat, bright modern kitchen, photorealistic 8K, no text' },
    { file: 'hero-2.jpg',  size: 'portrait',  prompt: 'Plumbing technician installing new tankless water heater on clean garage wall — professional blue uniform, Navien or Rinnai unit, neat pipe connections, photorealistic 8K, no text' },
    { file: 'hero-3.jpg',  size: 'portrait',  prompt: 'Happy family with working plumbing — mother and child washing hands at sparkling clean sink, bright modern bathroom, clean chrome faucet, photorealistic 8K, no text' },
    { file: 'pipes.jpg',   size: 'landscape', prompt: 'Expert plumber doing copper pipe installation in new home construction — professional technique soldering connections, organized work area, photorealistic 8K, no text' },
    { file: 'drain.jpg',   size: 'portrait',  prompt: 'Professional drain cleaning service — technician using professional hydro-jet equipment in driveway, clean professional setup, branded truck visible, photorealistic 8K, no text' },
  ],

  cleaning: [
    { file: 'hero-bg.jpg', size: 'landscape', prompt: 'Perfectly clean immaculate modern home interior — gleaming hardwood floors, spotless white kitchen countertops, sparkling stainless appliances, fresh flowers, bright natural light streaming through clean windows, photorealistic 8K interior photography, no text, no people' },
    { file: 'hero-1.jpg',  size: 'portrait',  prompt: 'Professional female cleaning specialist in teal uniform steam-cleaning gleaming white kitchen — spotless countertops, sparkling chrome fixtures, natural window light, warm welcoming atmosphere, photorealistic 8K, no text' },
    { file: 'hero-2.jpg',  size: 'portrait',  prompt: 'Two professional cleaning staff in matching teal and white uniforms arriving at beautiful suburban home entrance — supply caddy with premium products, smiling confidently, sunny front porch, photorealistic 8K, no text' },
    { file: 'hero-3.jpg',  size: 'portrait',  prompt: 'Sparkling clean modern bathroom after professional deep clean — white fluffy towels folded neatly, spotless mirror and chrome fixtures gleaming, fresh orchid on vanity, soft natural light, photorealistic 8K, no text' },
    { file: 'supplies.jpg',size: 'landscape', prompt: 'Premium professional cleaning supplies and equipment — eco-friendly branded cleaning products, microfiber cloths, steam mop, on white background, professional product photography, photorealistic 8K, no text' },
    { file: 'result.jpg',  size: 'portrait',  prompt: 'Satisfied homeowner arms crossed smiling in immaculate freshly cleaned bright living room — sunlight through spotless windows, gleaming floors, decluttered space, photorealistic 8K, no text' },
  ],

  landscaping: [
    { file: 'hero-bg.jpg', size: 'landscape', prompt: 'Stunning professionally landscaped front yard — lush green manicured lawn, colorful flower borders, stone pathway, ornamental trees, luxury suburban home backdrop, golden hour lighting, photorealistic 8K architectural exterior photography, no text' },
    { file: 'hero-1.jpg',  size: 'portrait',  prompt: 'Professional landscaping crew mowing and edging pristine lawn at luxury home — green uniforms, commercial equipment, manicured results visible, sunny day, photorealistic 8K, no text' },
    { file: 'hero-2.jpg',  size: 'portrait',  prompt: 'Landscape designer kneeling planting colorful seasonal flowers in beautiful garden bed at suburban home — professional green uniform, warm natural light, lush garden surroundings, photorealistic 8K, no text' },
    { file: 'hero-3.jpg',  size: 'portrait',  prompt: 'Beautiful backyard outdoor living space after professional landscaping — stone patio, outdoor fireplace, lush planted borders, string lights overhead, twilight golden hour, photorealistic 8K, no text' },
    { file: 'lawn.jpg',    size: 'landscape', prompt: 'Perfectly manicured golf course quality residential lawn — deep green immaculate turf with precise mowing stripes, beautiful suburban home, morning dew on grass, photorealistic 8K, no text' },
    { file: 'install.jpg', size: 'landscape', prompt: 'Professional hardscape installation — flagstone patio being laid by skilled crew, precision work visible, beautiful suburban backyard transformation in progress, photorealistic 8K, no text' },
  ],

  'auto-detailing': [
    { file: 'hero-bg.jpg', size: 'landscape', prompt: 'Luxury automotive detailing studio — matte black Porsche 911 center stage under professional LED ceiling lights, polished epoxy floor reflecting gleaming car, pristine professional environment, photorealistic 8K automotive photography, no text' },
    { file: 'hero-1.jpg',  size: 'portrait',  prompt: 'Expert auto detailer applying ceramic coating to black luxury vehicle — DA polisher in hand, perfect reflection in paint, professional detailing facility, focused craftsman expression, photorealistic 8K, no text' },
    { file: 'hero-2.jpg',  size: 'portrait',  prompt: 'Premium paint correction result — stunning deep glossy reflection in dark luxury car paint, like glass mirror finish, professional LED light showing zero swirls, photorealistic 8K automotive macro photography, no text' },
    { file: 'hero-3.jpg',  size: 'portrait',  prompt: 'Professional detailer hand-polishing luxury wheel on Ferrari or Lamborghini — perfect chrome finish, professional detailing bay, premium equipment, photorealistic 8K, no text' },
    { file: 'ceramic.jpg', size: 'landscape', prompt: 'Water beading on ceramic coated car hood — perfect hydrophobic effect, water pearling in tight beads on deep black paint, dramatic side lighting showing coating effectiveness, photorealistic 8K macro automotive photography, no text' },
    { file: 'interior.jpg',size: 'landscape', prompt: 'Immaculately detailed luxury car interior — deep conditioned tan leather seats, spotless dashboard, steam cleaned carpet, gleaming trim, professional interior detailing result, photorealistic 8K, no text' },
  ],

  remodeling: [
    { file: 'hero-bg.jpg',   size: 'landscape', prompt: 'Stunning fully remodeled open-concept kitchen and living space — custom white shaker cabinetry, quartz waterfall island, professional appliances, hardwood floors, vaulted ceiling, wide angle interior photography, photorealistic 8K, no text, no people' },
    { file: 'hero-1.jpg',    size: 'portrait',  prompt: 'Professional remodeling contractor reviewing architectural blueprints with homeowners at kitchen island — confident expert, new construction visible behind, photorealistic 8K, no text' },
    { file: 'hero-2.jpg',    size: 'portrait',  prompt: 'Dramatic bathroom remodel result — luxurious frameless glass walk-in shower with marble tile, freestanding soaking tub, dual floating vanity, warm modern lighting, photorealistic 8K interior photography, no text' },
    { file: 'project-1.jpg', size: 'landscape', prompt: 'Beautiful custom kitchen remodel — two-tone navy and white cabinetry, brass hardware, marble backsplash, Thermador appliances, pendant lighting, photorealistic 8K interior photography, no text, no people' },
    { file: 'project-2.jpg', size: 'landscape', prompt: 'Home addition with vaulted ceiling and skylights — bright new sunroom addition flowing from main house, hardwood floors, large windows, seamlessly integrated, wide angle interior photography, photorealistic 8K, no text' },
    { file: 'before-after.jpg', size: 'landscape', prompt: 'Dramatic home remodel transformation diptych — left half shows dated 1990s kitchen with old tile and oak cabinets, right half shows same space after stunning modern remodel with white quartz and stainless, professional real estate photography, photorealistic 8K, no text' },
  ],

  dentist: [
    { file: 'hero-bg.jpg', size: 'landscape', prompt: 'Modern luxury dental office reception area — clean white and wood aesthetic, comfortable waiting chairs, live plant wall, reception desk with friendly staff, bright airy atmosphere, photorealistic 8K interior photography, no text, no people visible' },
    { file: 'hero-1.jpg',  size: 'portrait',  prompt: 'Friendly female dentist in white coat smiling warmly in modern dental operatory — professional and approachable, dental equipment softly blurred behind, photorealistic 8K, no text' },
    { file: 'hero-2.jpg',  size: 'landscape', prompt: 'Gorgeous young woman with brilliant radiant confident smile — perfect white teeth fully visible, beautiful warm laugh, dental clinic softly blurred behind, cinematic wide beauty portrait, photorealistic 8K, no text' },
    { file: 'hero-3.jpg',  size: 'portrait',  prompt: 'State-of-the-art dental operatory room — modern reclining chair, overhead LED light, digital X-ray equipment, clean white walls, professional welcoming atmosphere, photorealistic 8K, no text, no people' },
    { file: 'consult.jpg', size: 'portrait',  prompt: 'Dentist and patient consultation — patient in chair smiling at caring dentist who shows digital smile design on tablet, warm clinical lighting, comfortable modern dental suite, photorealistic 8K, no text' },
    { file: 'smile.jpg',   size: 'portrait',  prompt: 'Perfect smile close-up — beautiful straight white teeth with healthy pink gums, macro dental photography lighting, clean white backdrop, professional dental beauty editorial, photorealistic 8K, no text' },
  ],

  restaurant: [
    { file: 'hero-bg.jpg', size: 'landscape', prompt: 'Vibrant upscale restaurant interior at dinner service — warm Edison bulb lighting, leather booths, open kitchen visible with flames, wine glasses glinting, lively upscale atmosphere, cinematic wide angle interior photography, photorealistic 8K, no text' },
    { file: 'hero-1.jpg',  size: 'portrait',  prompt: 'Executive chef in white chef coat plating an exquisite signature dish with artistic precision — commercial kitchen, warm dramatic lighting, steam rising, professional food photography, photorealistic 8K, no text' },
    { file: 'hero-2.jpg',  size: 'landscape', prompt: 'Hero shot of stunning signature restaurant dish — perfectly plated gourmet entrée with microgreens garnish, drizzle of reduction sauce, marble table surface, soft dramatic lighting, professional food editorial photography, photorealistic 8K, no text' },
    { file: 'hero-3.jpg',  size: 'portrait',  prompt: 'Happy group of friends celebrating at restaurant table — raising wine glasses in toast, beautiful food spread on table, warm atmospheric restaurant lighting, genuine joyful moment, photorealistic 8K, no text' },
    { file: 'dish-2.jpg',  size: 'landscape', prompt: 'Stunning appetizer spread — artfully arranged charcuterie board with cured meats, aged cheeses, fresh fruits, honeycomb, nuts, on rustic wood board, warm restaurant lighting, professional food photography, photorealistic 8K, no text' },
    { file: 'ambience.jpg',size: 'landscape', prompt: 'Romantic restaurant table setting for two — white linen tablecloth, crystal wine glasses, flickering candle, single rose, warm golden evening ambience, shallow depth of field, photorealistic 8K, no text, no people' },
  ],

  lawfirm: [
    { file: 'hero-bg.jpg',  size: 'landscape', prompt: 'Prestigious law firm reception lobby — dark walnut wood paneling, leather seating, scales of justice sculpture, subtle recessed lighting, impressive bookshelf of law volumes, commanding professional atmosphere, photorealistic 8K interior photography, no text, no people' },
    { file: 'hero-1.jpg',   size: 'portrait',  prompt: 'Confident senior male attorney in mid-50s in tailored navy suit and tie — silver hair, strong trustworthy face, law library bookshelf behind, warm directional studio lighting, professional corporate headshot, photorealistic 8K, no text' },
    { file: 'hero-2.jpg',   size: 'portrait',  prompt: 'Attorney consulting with client across mahogany desk — professional documents visible, engaged active listening body language, wood-paneled law office, afternoon light, photorealistic 8K, no text' },
    { file: 'hero-3.jpg',   size: 'portrait',  prompt: 'Powerful female attorney in sharp charcoal blazer standing confidently in law office — arms folded, direct confident gaze, law books and window behind, professional portrait lighting, photorealistic 8K, no text' },
    { file: 'office.jpg',   size: 'landscape', prompt: 'Impressive partner-level law office — floor-to-ceiling law books, mahogany desk with organized documents, leather chair, large window with city view, commanding professional space, photorealistic 8K interior, no text, no people' },
    { file: 'courtroom.jpg',size: 'landscape', prompt: 'Attorney standing confidently in modern courtroom — professional suit, addressing judge, American flag visible, formal wood paneling and gallery, photorealistic 8K, no text' },
  ],

  'luxury-realestate': [
    { file: 'hero-bg.jpg', size: 'landscape', prompt: 'Stunning luxury estate home exterior at twilight — architectural masterpiece with warm light glowing from windows, infinity pool reflecting evening sky, manicured grounds with uplighting, prestigious neighborhood, photorealistic 8K architectural photography, no text' },
    { file: 'hero-1.jpg',  size: 'portrait',  prompt: 'Elite luxury real estate agent in designer suit standing confidently in front of spectacular $5M listing — confident professional smile, keys in hand, luxury home entrance behind, golden hour lighting, photorealistic 8K, no text' },
    { file: 'hero-2.jpg',  size: 'landscape', prompt: 'Breathtaking luxury home great room — soaring 20-foot ceilings, floor-to-ceiling stone fireplace, designer furniture, panoramic windows overlooking infinity pool and city view, twilight golden light, wide angle interior, photorealistic 8K, no text, no people' },
    { file: 'hero-3.jpg',  size: 'portrait',  prompt: 'Luxury real estate agent showing spectacular property — guiding clients through grand foyer of architectural showpiece home, marble floors, chandelier, photorealistic 8K, no text' },
    { file: 'pool.jpg',    size: 'landscape', prompt: 'Infinity pool at luxury estate at golden hour — perfect still water reflecting pink and gold sky, landscaped terraces, cabana, outdoor kitchen, ultra-premium residential photography, photorealistic 8K, no text, no people' },
    { file: 'kitchen.jpg', size: 'landscape', prompt: 'Ultra-luxury kitchen in $10M home — custom waterfall island in Calacatta marble, Sub-Zero Wolf appliances, custom cabinetry to ceiling, butler pantry visible, professional interior photography, photorealistic 8K, no text, no people' },
  ],

  'junk-removal': [
    { file: 'hero-bg.jpg', size: 'landscape', prompt: 'Dramatic before-after home cleanout — left side cluttered garage with boxes, furniture debris; right side same space completely empty clean and organized, professional interior photography, photorealistic 8K, no text' },
    { file: 'hero-1.jpg',  size: 'portrait',  prompt: 'Professional junk removal crew in matching branded green uniforms efficiently loading furniture into large company truck — clean professional service, sunny day, suburban driveway, photorealistic 8K, no text' },
    { file: 'hero-2.jpg',  size: 'portrait',  prompt: 'Happy homeowners standing in their freshly cleared-out garage — huge empty clean space, big smiles of relief, bright day, photorealistic 8K, no text' },
    { file: 'hero-3.jpg',  size: 'portrait',  prompt: 'Junk removal technician using hand truck to efficiently remove old appliance from home — professional uniform, clean organized workflow, photorealistic 8K, no text' },
    { file: 'truck.jpg',   size: 'landscape', prompt: 'Professional junk removal truck loaded with household items — company branded truck, organized load, clean suburban street, professional service photography, photorealistic 8K, no text' },
    { file: 'clear.jpg',   size: 'landscape', prompt: 'Completely cleared and cleaned basement after professional junk removal — bright lights showing empty clean space, concrete floor swept, photorealistic 8K, no text, no people' },
  ],

  daycare: [
    { file: 'hero-bg.jpg', size: 'landscape', prompt: 'Beautiful bright modern daycare classroom — colorful learning stations, low child-height shelves with educational toys, large windows with natural light, clean organized nurturing environment, professional interior photography, photorealistic 8K, no text, no children' },
    { file: 'hero-1.jpg',  size: 'portrait',  prompt: 'Warm caring female teacher reading a picture book to circle of engaged happy toddlers — colorful daycare classroom, bright educational posters, natural light, genuine joyful learning moment, photorealistic 8K, no text' },
    { file: 'hero-2.jpg',  size: 'portrait',  prompt: 'Excited preschool children engaged in creative arts and crafts at table — bright colors, genuine learning engagement, caring teacher nearby, safe nurturing environment, photorealistic 8K, no text' },
    { file: 'hero-3.jpg',  size: 'portrait',  prompt: 'Happy parent dropping off smiling toddler at daycare entrance — warm greeting from caregiver, child excited, safe welcoming facility, sunny morning, photorealistic 8K, no text' },
    { file: 'playground.jpg', size: 'landscape', prompt: 'Safe modern daycare playground — age-appropriate colorful equipment, rubber safety surfacing, children playing happily in supervised outdoor area, bright sunny day, photorealistic 8K, no text' },
    { file: 'learn.jpg',   size: 'landscape', prompt: 'Preschool children working on letter recognition at colorful classroom table — focused engaged learning, teacher guiding, bright educational materials, photorealistic 8K, no text' },
  ],

  'pressure-washing': [
    { file: 'hero-bg.jpg', size: 'landscape', prompt: 'Dramatic driveway pressure washing transformation — left half dirty stained concrete, right half gleaming white clean concrete, clear dividing line showing contrast, professional cleaning photography, photorealistic 8K, no text' },
    { file: 'hero-1.jpg',  size: 'portrait',  prompt: 'Professional pressure washing technician in branded uniform operating commercial-grade hot water pressure washer on home driveway — powerful water stream removing years of stains, sunny day, photorealistic 8K, no text' },
    { file: 'hero-2.jpg',  size: 'landscape', prompt: 'Stunning house washing result — beautiful vinyl home exterior gleaming bright white after professional pressure washing, lush green lawn, bright sun, like-new curb appeal, photorealistic 8K, no text' },
    { file: 'hero-3.jpg',  size: 'portrait',  prompt: 'Close-up of pressure washing cleaning deck boards — powerful focused water stream removing green algae from composite deck, satisfying clean result, photorealistic 8K macro, no text' },
    { file: 'deck.jpg',    size: 'landscape', prompt: 'Beautiful deck before and after pressure washing — weathered gray stained left half, bright clean restored wood right half, dramatic transformation, photorealistic 8K, no text' },
    { file: 'truck.jpg',   size: 'landscape', prompt: 'Professional pressure washing service truck — commercial hot water unit mounted in truck bed, hose reels, professional setup, company van parked at residential property, photorealistic 8K, no text' },
  ],

  'epoxy-flooring': [
    { file: 'hero-bg.jpg',   size: 'landscape', prompt: 'Stunning showroom-quality epoxy garage floor — metallic blue-grey flake epoxy with high-gloss finish, luxury cars parked on it, perfect mirror reflection, modern home garage, photorealistic 8K, no text, no people' },
    { file: 'hero-1.jpg',    size: 'portrait',  prompt: 'Epoxy flooring technician applying metallic epoxy coating with squeegee — professional protective suit, dramatic color pour, residential garage, photorealistic 8K, no text' },
    { file: 'hero-2.jpg',    size: 'landscape', prompt: 'Commercial kitchen with professional food-grade epoxy floor — seamless gray epoxy coating, high gloss finish, anti-slip texture, professional kitchen equipment, photorealistic 8K, no text, no people' },
    { file: 'hero-3.jpg',    size: 'portrait',  prompt: 'Homeowner admiring stunning new metallic epoxy garage floor — jaw-dropped amazement, reflective floor like liquid metal, organized garage with cabinets, photorealistic 8K, no text' },
    { file: 'metallic.jpg',  size: 'landscape', prompt: 'Close-up of luxury metallic epoxy floor — swirling pearl and charcoal metallic pigments in high-gloss clear coat, like abstract art underfoot, macro photography showing depth, photorealistic 8K, no text' },
    { file: 'flake.jpg',     size: 'landscape', prompt: 'Garage floor with premium color flake epoxy system — full broadcast flake in grey and white, sealed with diamond clear topcoat, matching wall cabinets, organized workshop, photorealistic 8K, no text, no people' },
  ],

  'tree-services': [
    { file: 'hero-bg.jpg', size: 'landscape', prompt: 'Professional arborist team removing large tree in residential backyard — certified crew with safety equipment, crane visible, carefully controlled removal, suburban neighborhood, photorealistic 8K, no text' },
    { file: 'hero-1.jpg',  size: 'portrait',  prompt: 'Certified arborist in safety gear climbing large oak tree with professional equipment — ISA certified, safety harness, chainsaw, confident expert posture, photorealistic 8K, no text' },
    { file: 'hero-2.jpg',  size: 'landscape', prompt: 'Beautiful expertly trimmed trees framing luxury suburban home — professional crown shaping result, healthy lush canopy, perfect curb appeal, photorealistic 8K, no text' },
    { file: 'hero-3.jpg',  size: 'portrait',  prompt: 'Tree service crew doing stump grinding — professional equipment removing large stump, clean efficient process, suburban yard, photorealistic 8K, no text' },
    { file: 'trim.jpg',    size: 'landscape', prompt: 'Professional tree trimming showing before and after — overgrown tree left, beautifully shaped pruned tree right, clear sky backdrop, photorealistic 8K, no text' },
    { file: 'removal.jpg', size: 'landscape', prompt: 'Clean yard after professional tree removal — freshly ground stump, wood chips raked, yard restored, professional cleanup complete, satisfied homeowner in background, photorealistic 8K, no text' },
  ],

  'basement-waterproofing': [
    { file: 'hero-bg.jpg', size: 'landscape', prompt: 'Beautiful finished basement after professional waterproofing — dry bright space converted to family room, luxury vinyl flooring, no water stains or moisture, photorealistic 8K, no text, no people' },
    { file: 'hero-1.jpg',  size: 'portrait',  prompt: 'Waterproofing specialist installing interior drain tile system in basement — professional uniform, concrete saw cutting, professional systematic process, photorealistic 8K, no text' },
    { file: 'hero-2.jpg',  size: 'landscape', prompt: 'Exterior basement waterproofing excavation — crew applying rubberized membrane to foundation wall, drainage board installation, professional process visible, photorealistic 8K, no text' },
    { file: 'hero-3.jpg',  size: 'portrait',  prompt: 'Happy homeowner in dry finished basement — pointing to clean dry walls, finished space behind, no moisture visible, photorealistic 8K, no text' },
    { file: 'sump.jpg',    size: 'portrait',  prompt: 'Professional sump pump installation in clean basement — TripleSafe or WaterGuard system, discharge pipe, professional clean installation, photorealistic 8K, no text' },
    { file: 'drain.jpg',   size: 'landscape', prompt: 'Interior perimeter drainage system installed in basement — concrete channel, gravel bed, clean professional installation visible before concrete pour, photorealistic 8K, no text' },
  ],

  'foundation-repair': [
    { file: 'hero-bg.jpg', size: 'landscape', prompt: 'Professional foundation repair in progress — workers installing steel push piers along home foundation, organized crew, safety equipment, suburban home, photorealistic 8K, no text' },
    { file: 'hero-1.jpg',  size: 'portrait',  prompt: 'Foundation repair engineer doing structural assessment — examining crack in foundation wall with inspection light, clipboard, professional expertise, photorealistic 8K, no text' },
    { file: 'hero-2.jpg',  size: 'landscape', prompt: 'Carbon fiber strap reinforcement on bowing basement wall — professional installation of Fortress carbon fiber straps anchored to floor and joists, clean professional work, photorealistic 8K, no text' },
    { file: 'hero-3.jpg',  size: 'portrait',  prompt: 'Homeowner confident after foundation repair — standing in dry stable basement, thumbs up, visible repaired wall behind, photorealistic 8K, no text' },
    { file: 'pier.jpg',    size: 'portrait',  prompt: 'Galvanized steel push pier system installed below home foundation — professional helical pier exposed during excavation, structural reinforcement visible, photorealistic 8K, no text' },
    { file: 'crack.jpg',   size: 'landscape', prompt: 'Before and after foundation crack repair — left: significant stair-step crack in brick foundation, right: same area with professional epoxy injection repair, clean filled crack, photorealistic 8K, no text' },
  ],

  'septic-services': [
    { file: 'hero-bg.jpg', size: 'landscape', prompt: 'Professional septic service truck at rural residential property — large vacuum truck, technician at tank access point, organized professional setup, green grass yard, photorealistic 8K, no text' },
    { file: 'hero-1.jpg',  size: 'portrait',  prompt: 'Septic technician in professional uniform inspecting septic tank — camera inspection equipment, professional assessment process, photorealistic 8K, no text' },
    { file: 'hero-2.jpg',  size: 'landscape', prompt: 'New septic system installation — crew installing concrete septic tank and leach field pipes in open excavation, professional organized work, photorealistic 8K, no text' },
    { file: 'hero-3.jpg',  size: 'portrait',  prompt: 'Septic pump-out service in progress — professional hose going into open tank, technician operating pump controls on service truck, professional process, photorealistic 8K, no text' },
    { file: 'truck.jpg',   size: 'landscape', prompt: 'Professional septic service company truck — branded vacuum truck parked at residential property, company logo visible, professional fleet vehicle, photorealistic 8K, no text' },
    { file: 'repair.jpg',  size: 'landscape', prompt: 'Septic system repair complete — freshly installed distribution box and D-box connections, professional installation, restored lawn area, green healthy grass, photorealistic 8K, no text' },
  ],
}

const SIZE_MAP = {
  landscape: '1536x1024',
  portrait: '1024x1536',
  square: '1024x1024',
}

async function generateImage(prompt: string, size: 'landscape' | 'portrait' | 'square' = 'landscape'): Promise<Buffer | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-image-1',
          prompt,
          n: 1,
          size: SIZE_MAP[size],
          quality: QUALITY,
        }),
      })

      if (!res.ok) {
        const err = await res.text()
        console.error(`  [OpenAI error ${res.status}]:`, err.slice(0, 200))
        if (res.status === 400 || res.status === 401) return null // fatal, don't retry
        await new Promise(r => setTimeout(r, 3000 * (attempt + 1)))
        continue
      }

      const data = await res.json() as any
      const b64 = data?.data?.[0]?.b64_json
      if (!b64) {
        console.error('  No b64_json in response')
        continue
      }
      return Buffer.from(b64, 'base64')
    } catch (e: any) {
      console.error(`  Attempt ${attempt + 1} failed:`, e.message)
      await new Promise(r => setTimeout(r, 3000 * (attempt + 1)))
    }
  }
  return null
}

async function main() {
  const nicheArg = process.env.NICHE ?? process.argv[2]

  const niches = nicheArg
    ? (LIBRARY[nicheArg] ? [nicheArg] : (() => { console.error(`Unknown niche: ${nicheArg}`); process.exit(1) })())
    : Object.keys(LIBRARY)

  const totalImages = niches.reduce((s, n) => s + LIBRARY[n].length, 0)
  const costEstimate = (totalImages * PRICE[QUALITY]).toFixed(2)

  console.log(`\n🎨 OpenAI gpt-image-1 Niche Library Generator`)
  console.log(`   Quality: ${QUALITY} | ${totalImages} images | Est. cost: $${costEstimate}`)
  console.log(`   Niches: ${niches.join(', ')}\n`)

  let generated = 0, skipped = 0, failed = 0

  for (const niche of niches) {
    const shots = LIBRARY[niche]
    const outDir = path.join(ASSETS_DIR, niche)
    fs.mkdirSync(outDir, { recursive: true })

    console.log(`\n=== ${niche} (${shots.length} images) ===`)

    for (const shot of shots) {
      const outPath = path.join(outDir, shot.file)

      if (SKIP_EXISTING && fs.existsSync(outPath)) {
        console.log(`  ⏭ skip  ${shot.file} (exists)`)
        skipped++
        continue
      }

      const size = shot.size ?? 'landscape'
      process.stdout.write(`  ⏳ gen   ${shot.file} [${size}]...`)
      const buf = await generateImage(shot.prompt, size)

      if (buf) {
        fs.writeFileSync(outPath, buf)
        console.log(` ✓ ${(buf.length / 1024).toFixed(0)}KB`)
        generated++
      } else {
        console.log(` ✗ FAILED`)
        failed++
      }

      // Rate limit: ~1 req/sec
      await new Promise(r => setTimeout(r, 1200))
    }
  }

  console.log(`\n✅ Done: ${generated} generated, ${skipped} skipped, ${failed} failed`)
  console.log(`   Saved to: ${ASSETS_DIR}`)
}

main().catch(console.error)
