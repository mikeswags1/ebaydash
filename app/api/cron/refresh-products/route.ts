import { NextRequest } from 'next/server'
import { apiError, apiOk } from '@/lib/api-response'
import { getValidEbayAccessToken } from '@/lib/ebay-auth'
import { queryRows, sql } from '@/lib/db'
import { scrapeAmazonSearch } from '@/lib/amazon-scrape'
import { ensureProductSourceTables, rebuildProductSourceFromCache, repriceProductSourceItems, refreshProductSourcePrices } from '@/lib/product-source-engine'
import { getListingPolicyFlags, hasBlockedListingPolicyFlag } from '@/lib/listing-policy'
import { EBAY_DEFAULT_FEE_RATE, getListingMetrics, getRecommendedEbayPrice } from '@/lib/listing-pricing'

export const maxDuration = 300

// ── Shared helpers (mirrored from product-finder) ────────────────────────────
const MIN_PROFIT = 6
const MAX_COST = 300
const CACHE_VERSION = 6
const CONTINUOUS_CACHE_KEY = '__continuous_listing__'
const MAX_CONTINUOUS_POOL_SIZE = 600
const STANDARD_NICHE_TARGET = 200
const CATALOG_NICHE_TARGET = 2500
const SCHEDULED_NICHE_BATCH_SIZE = 8
const CATALOG_NICHE_BATCH_SIZE = 3

const REJECT_KEYWORDS = [
  'rc plane','rc airplane','drone','laptop','tablet','ipad','iphone','macbook',
  'treadmill','elliptical','mattress','sofa','couch','generator','chainsaw',
  'television',' tv ','monitor','e-bike','pressure washer',
  'louis vuitton','lv bag','gucci','chanel','prada','burberry','versace','fendi',
  'christian dior','yves saint laurent','hermes','hermès','balenciaga','givenchy',
  'rolex','omega watch','patek philippe','audemars piguet','hublot','cartier watch',
  'ray-ban','oakley sunglass','canada goose jacket','moncler jacket',
  'lego set','lego technic','lego duplo',
]

function calcMetrics(amazonPrice: number) {
  const ebayPrice = getRecommendedEbayPrice(amazonPrice, EBAY_DEFAULT_FEE_RATE)
  const { profit, roi } = getListingMetrics(amazonPrice, ebayPrice, EBAY_DEFAULT_FEE_RATE)
  return { ebayPrice, profit, roi }
}

function parsePrice(v: unknown): number {
  if (!v) return 0
  if (typeof v === 'number') return v
  const n = parseFloat(String(v).replace(/[^0-9.]/g, ''))
  return isNaN(n) ? 0 : n
}

function repriceCachedProduct(product: Record<string, unknown>, sourceNiche: string) {
  const amazonPrice = parsePrice(product.amazonPrice)
  if (amazonPrice <= 0) return null
  const { ebayPrice, profit, roi } = calcMetrics(amazonPrice)
  const risk = amazonPrice > 150 ? 'HIGH' : amazonPrice > 60 || roi < 45 ? 'MEDIUM' : 'LOW'
  return {
    ...product,
    amazonPrice,
    ebayPrice,
    profit,
    roi,
    risk,
    sourceNiche: product.sourceNiche || sourceNiche,
  }
}

function isRejected(title: string) {
  return hasBlockedListingPolicyFlag(getListingPolicyFlags({ title }))
}

const NICHE_QUERIES: Record<string, string[]> = {
  'Phone Accessories': [
    'phone case wireless charger', 'screen protector tempered glass', 'phone stand holder desk',
    'portable battery pack charger', 'phone grip ring holder', 'car phone mount vent',
    'lightning cable fast charging 6ft', 'usb c cable braided fast charge',
    'phone wallet case card holder', 'wireless charging pad station',
    'iphone case clear protective', 'android phone case heavy duty',
    'screen protector privacy filter', 'phone shoulder bag crossbody',
    'phone sanitizer uv light', 'selfie ring light phone',
    'pop socket phone grip', 'phone waterproof pouch case',
    'bluetooth headset earpiece wireless', 'phone camera lens kit wide angle',
  ],
  'Computer Parts': [
    'usb c hub multiport adapter', 'laptop stand ergonomic adjustable',
    'mechanical keyboard compact tkl', 'wireless mouse ergonomic silent',
    'monitor stand riser with storage', 'laptop cooling pad fan',
    'usb hub 4 port splitter', 'hdmi cable 4k 6ft',
    'webcam 1080p streaming', 'laptop sleeve bag 15 inch',
    'keyboard wrist rest memory foam', 'mouse pad xxl desk mat',
    'cable organizer clips desk', 'laptop docking station dual monitor',
    'privacy screen filter 15 inch', 'computer speaker usb powered',
    'ssd hard drive external 1tb', 'led desk pad gaming mouse pad',
    'usb c to hdmi adapter 4k', 'screen cleaning kit microfiber',
  ],
  'Audio & Headphones': [
    'wireless earbuds bluetooth noise cancelling', 'portable bluetooth speaker waterproof',
    'headphone stand holder aluminum', 'over ear headphones wired studio',
    'earbuds true wireless sport sweat proof', 'bluetooth speaker shower waterproof small',
    'gaming headset surround sound pc', 'bone conduction headphones open ear',
    'microphone usb condenser streaming', 'speaker wire 16 gauge 50ft',
    'headphone amplifier portable dac', 'aux cable 3.5mm 6ft braided',
    'earphone tips replacement silicone', 'soundbar small tv desk',
    'record player bluetooth turntable', 'noise cancelling ear muffs shooting',
    'karaoke microphone bluetooth wireless', 'kids headphones volume limited',
    'in ear monitor stage performance', 'audio interface usb recording',
  ],
  'Smart Home Devices': [
    'smart plug wifi outlet alexa', 'smart home security camera indoor',
    'smart led bulb color changing rgbw', 'video doorbell wireless battery',
    'motion sensor light indoor outdoor', 'smart thermostat wifi programmable',
    'smart lock deadbolt keypad', 'indoor security camera 360 pan tilt',
    'smart power strip surge protector', 'smart switch no neutral wire',
    'smart smoke carbon monoxide detector', 'wifi garage door opener controller',
    'smart led strip lights room 16ft', 'smart display screen alexa show',
    'mesh wifi router system whole home', 'smart water leak sensor detector',
    'smart window blind motor', 'robot vacuum mop wifi',
    'air purifier hepa filter room', 'smart irrigation controller wifi',
  ],
  'Gaming Gear': [
    'gaming mouse pad xxl rgb', 'gaming headset surround sound led',
    'mechanical keyboard gaming rgb switch', 'gaming controller holder stand',
    'gaming chair lumbar support pillow', 'capture card 4k hdmi streaming',
    'gaming desk cable management', 'controller charging station ps5',
    'thumb grips analog stick caps', 'gaming headset stand holder',
    'led strip lights gaming room', 'monitor light bar gaming',
    'controller trigger extenders fps', 'gaming glasses blue light blocking',
    'ps5 controller skin wrap', 'xbox controller battery pack rechargeable',
    'gaming router ethernet switch', 'wrist support gaming brace',
    'gaming chair mat floor protector', 'rgb fan case 120mm',
  ],
  'Kitchen Gadgets': [
    'kitchen gadgets silicone utensils set', 'air fryer accessories baking pan',
    'mandoline slicer vegetables adjustable', 'instant pot accessories steamer basket',
    'kitchen scale digital 11lb', 'food storage containers glass set',
    'avocado slicer 3 in 1 tool', 'egg slicer mushroom cutter',
    'spiralizer vegetable slicer zucchini', 'salad spinner large bowl',
    'knife sharpener electric 3 stage', 'silicone baking mat sheet pan liner',
    'meat thermometer instant read wireless', 'can opener electric automatic',
    'immersion blender handheld stick', 'garlic press stainless steel rocker',
    'measuring cups spoons set magnetic', 'cast iron skillet cleaner scraper',
    'coffee grinder burr manual hand', 'vacuum sealer food bags rolls',
  ],
  'Home Decor': [
    'wall art prints framed bedroom', 'decorative throw pillow covers 18x18',
    'scented candle set lavender vanilla', 'picture frames collage set wall',
    'artificial plants succulents pot', 'woven wall hanging tapestry boho',
    'decorative tray coffee table gold', 'string lights fairy bedroom curtain',
    'table runner burlap linen farmhouse', 'vase ceramic modern minimalist',
    'wall clock silent non ticking wood', 'decorative lantern candle holder',
    'bathroom accessories set 4 piece', 'welcome mat doormat outdoor non slip',
    'mirror round wall mounted gold', 'floating shelves wall mounted set',
    'cabinet knobs pulls drawer handle', 'curtain rods adjustable double',
    'rug pad gripper non slip hardwood', 'decorative bowl fruit centerpiece',
  ],
  'Furniture & Lighting': [
    'led desk lamp usb charging eye care', 'floor lamp tripod living room linen',
    'wall sconce light plug in cord', 'under cabinet led light strip kitchen',
    'solar outdoor garden lights path', 'led candles flameless remote timer',
    'nightstand lamp bedside table touch', 'pendant light cord ceiling fixture',
    'string patio lights outdoor 48ft', 'vanity mirror light led makeup',
    'clamp desk lamp reading arm swing', 'closet organizer shelf tower',
    'folding table portable camping', 'tv tray table set 4 piece folding',
    'bar stool counter height adjustable', 'step ladder 3 step non slip',
    'bookshelf 5 tier industrial wood', 'file cabinet 2 drawer locking',
    'shower caddy tension pole rust proof', 'over door organizer hooks rack',
  ],
  'Cleaning Supplies': [
    'microfiber cleaning cloths 24 pack', 'cleaning brush kit bathroom grout',
    'mop bucket set spin self wringing', 'dust mop hardwood floor dry wet',
    'toilet brush holder set caddy', 'dish scrubber sponge holder',
    'cleaning spray bottle refillable 32oz', 'rubber gloves cleaning reusable',
    'squeegee shower door window cleaner', 'grout cleaner brush narrow stiff',
    'washing machine cleaning tablets', 'dryer vent cleaning brush kit',
    'stainless steel cleaner wipes polish', 'shower head cleaner descaler',
    'garbage disposal cleaner pods', 'toilet bowl cleaner stamps gel',
    'lint roller extra sticky refill', 'pet hair remover couch furniture',
    'wood floor cleaner concentrated', 'enzyme cleaner pet stain odor',
  ],
  'Storage & Organization': [
    'storage bins organizer closet fabric', 'vacuum storage bags space saver jumbo',
    'drawer organizer bamboo divider', 'under bed storage bags zippered',
    'closet organizer shirt hangers velvet', 'shoe rack organizer stackable',
    'over door shoe organizer pocket', 'pantry organizer bins canned goods',
    'cable organizer box hide cords', 'jewelry organizer box drawer insert',
    'garage storage shelving heavy duty', 'baskets bins for shelves wire',
    'file organizer desktop accordion', 'medicine cabinet organizer wall mount',
    'purse organizer hanging bag closet', 'toy storage chest bench kids',
    'spice rack organizer pull out', 'bathroom counter organizer set',
    'media storage tower dvd holder', 'luggage organizer packing cubes 8 set',
  ],
  'Camping & Hiking': [
    'camping lantern led rechargeable solar', 'tactical flashlight rechargeable 1000 lumen',
    'hiking water bottle insulated stainless', 'camping cookware set lightweight titanium',
    'sleeping bag 20 degree mummy', 'emergency bivvy survival blanket',
    'fire starter flint steel waterproof', 'trekking poles collapsible carbon',
    'camping hammock lightweight nylon', 'headlamp rechargeable 350 lumen',
    'water filter straw portable hiking', 'camp towel microfiber quick dry',
    'paracord bracelet survival tools', 'camp chair folding lightweight',
    'bear spray canister hiking', 'compass orienteering hiking',
    'multi tool knife camping folding', 'first aid kit compact outdoor',
    'rain poncho emergency waterproof', 'dry bag waterproof roll top',
  ],
  'Garden & Tools': [
    'garden tools set 5 piece planting', 'pruning shears bypass garden scissors',
    'garden hose expandable flexible kink free', 'garden gloves heavy duty thorns',
    'raised garden bed planter box cedar', 'kneeling pad garden cushion foam',
    'watering can 2 gallon indoor outdoor', 'plant labels garden markers stakes',
    'composting bin kitchen countertop', 'weed puller stand up weeder tool',
    'garden sprayer pump pressure 2 gallon', 'soil moisture meter sensor plant',
    'grow lights led indoor plants full spectrum', 'garden tote bag tools carrier',
    'tree pruning saw folding blade', 'leaf blower battery cordless lightweight',
    'bird feeder squirrel proof hanging', 'wind chimes outdoor garden large',
    'pot feet plant risers set ceramic', 'garden hose reel cart rolling',
  ],
  'Sporting Goods': [
    'resistance bands set 5 loop workout', 'knee brace support sports compression',
    'jump rope speed fitness weighted', 'yoga mat non slip thick exercise',
    'workout gloves weight lifting grip', 'ankle weights set 10lb pair',
    'pull up bar doorway no screw', 'exercise ball stability 65cm',
    'gymnastics mat folding 4 inch', 'speed agility ladder training',
    'boxing gloves training sparring', 'dumbbell neoprene coated set',
    'compression arm sleeve basketball', 'sport water bottle straw lid',
    'swimming goggles anti fog adult', 'running belt waist pack phone',
    'pickleball paddle lightweight carbon', 'badminton set backyard outdoor',
    'volleyball net portable beach', 'athletic knee sleeve pair',
  ],
  'Fishing & Hunting': [
    'fishing lure kit bass trout spinners', 'braided fishing line 30lb 300yd',
    'fishing tackle box organizer 3600', 'telescoping fishing rod travel',
    'fishing pliers stainless steel multi', 'fishing net rubber mesh handle',
    'trail camera wildlife 24mp no glow', 'hunting face mask camo mesh',
    'tree stand harness safety vest', 'game call deer turkey electronic',
    'fishing rod holder rack wall mount', 'fish scale digital 110lb',
    'fishing lure storage bag portable', 'scent eliminator spray hunting',
    'bow release aid trigger wrist', 'fishing hat sun protection wide brim',
    'camo netting ghillie suit', 'duck call set waterfowl',
    'fishing line clip bobber set', 'hook remover extractor pliers',
  ],
  'Fitness Equipment': [
    'resistance bands loop set heavy light', 'ab roller wheel core workout',
    'foam roller deep tissue massage', 'pull up bar multi grip doorway',
    'battle rope anchor strap training', 'speed rope jump fitness handles',
    'workout mat exercise yoga thick', 'slider discs core gliding carpet',
    'balance board wobble trainer', 'dip bar parallette bars push up',
    'barbell pad squat hip thrust', 'wrist ankle weight 5lb set',
    'exercise ball chair pump balance', 'agility ladder speed training set',
    'gymnastics rings wooden olympic', 'step aerobics platform adjustable',
    'weight bench foldable adjustable', 'knee sleeves compression 7mm',
    'lifting belt powerlifting lever', 'massage gun percussion deep tissue',
  ],
  'Personal Care': [
    'electric facial cleansing brush sonic', 'jade roller face gua sha set',
    'hair turban towel microfiber quick dry', 'nail file buffer block set',
    'eyebrow razor dermaplaning face', 'cuticle pusher nail care set',
    'facial steamer portable nano ionic', 'blackhead remover vacuum pore',
    'eyelash curler heated silicone', 'hair claw clips large women',
    'scalp massager shampoo brush', 'bath pillow spa cushion suction',
    'loofah sponge back scrubber long', 'nail drill electric set rechargeable',
    'hair diffuser universal blow dryer', 'tongue scraper stainless steel set',
    'electric callus remover foot file', 'facial massage roller ice globes',
    'shower cap reusable waterproof', 'teeth whitening strips 28 pack',
  ],
  'Medical Supplies': [
    'pulse oximeter fingertip blood oxygen', 'digital thermometer forehead no touch',
    'pill organizer weekly 4 times day', 'blood pressure monitor upper arm',
    'knee brace hinged support ligament', 'wrist brace carpal tunnel splint',
    'back brace lumbar support posture', 'ankle brace stabilizer sprain',
    'compression socks 20-30 mmhg women', 'heating pad electric fast heating',
    'ice pack reusable flexible gel', 'eye mask warm compress USB',
    'back massager cushion heat shiatsu', 'tens unit muscle stimulator pads',
    'nebulizer machine portable rechargeable', 'cervical neck traction pillow',
    'posture corrector back brace adult', 'finger splint stack brace',
    'foot massager plantar fasciitis', 'knee ice wrap compression cold',
  ],
  'Car Accessories': [
    'car phone mount dashboard vent', 'car organizer back seat trash bag',
    'car seat covers full set waterproof', 'car air freshener vent clip',
    'dash cam front rear dual 1080p', 'car cleaning kit detailing microfiber',
    'trunk organizer collapsible car', 'car sun shade windshield foldable',
    'jumper cables heavy duty 25ft', 'car vacuum cordless portable',
    'steering wheel cover non slip', 'seat gap filler car center console',
    'car first aid kit emergency roadside', 'blind spot mirror wide angle',
    'tire pressure gauge digital', 'car floor mats all weather heavy duty',
    'tint film window privacy solar', 'led interior lights rgb remote',
    'seat belt cover shoulder pad', 'car charger dual usb fast charge',
  ],
  'Car Parts': [
    'dash cam 4k front rear mirror', 'obd2 scanner bluetooth diagnostic',
    'jump starter portable battery 2000a', 'tire inflator portable 12v',
    'wiper blade universal 24 inch', 'cabin air filter replacement',
    'engine air filter performance', 'car battery charger trickle maintainer',
    'oil drain pan plug removal kit', 'spark plug socket set 5/8',
    'brake caliper wind back tool', 'headlight restoration kit polishing',
    'led headlight bulb conversion kit', 'license plate frame stainless',
    'fuse box replacement assorted', 'serpentine belt tool kit',
    'timing light engine automotive', 'socket set metric sae 40 piece',
    'car cover weatherproof outdoor', 'tonneau cover truck bed roll up',
  ],
  'Pet Supplies': [
    'dog dental chews tartar control large', 'cat interactive toy feather wand',
    'pet deshedding brush tool dog cat', 'dog harness no pull padded',
    'cat tree tower condo scratcher', 'dog collar adjustable nylon',
    'pet grooming glove brush remove hair', 'automatic pet feeder cat dog',
    'pet stroller large 4 wheel', 'dog puzzle toy interactive slow feeder',
    'cat litter mat double layer', 'dog bone chew toy aggressive chewer',
    'pet nail grinder quiet rechargeable', 'pet carrier airline approved soft',
    'reptile heat lamp basking bulb', 'aquarium filter canister quiet',
    'bird cage medium parakeet parrot', 'small animal bedding fleece liner',
    'dog seat cover back seat waterproof', 'elevated dog bowl stand stainless',
  ],
  'Baby & Kids': [
    'baby carrier wrap ergonomic newborn', 'toddler activity toy learning center',
    'silicone bib waterproof pocket catch', 'baby monitor video wifi',
    'white noise machine baby sleep', 'bath seat infant support ring',
    'baby food maker blender puree', 'teether toy sensory silicone',
    'diaper bag backpack large capacity', 'portable high chair booster seat',
    'baby gate pressure mounted stairs', 'nightlight projector star baby',
    'stroller organizer cup holder', 'infant carrier ring sling',
    'foam play mat interlocking tiles', 'baby swing portable indoor',
    'nursing pillow breastfeeding support', 'baby food storage containers',
    'car seat travel bag gate check', 'baby washcloths soft muslin set',
  ],
  'Toys & Games': [
    'fidget toys sensory pack adults kids', 'magnetic tiles building blocks 60pc',
    'card game family adults funny', 'kids science kit experiment set',
    'remote control car fast offroad', 'drone mini beginner indoor',
    'slime kit make your own activity', 'kinetic sand set mold tools',
    'outdoor lawn games set yard', 'foam dart blaster gun ammo',
    'educational flashcards kids learning', 'building blocks stem engineering',
    'stuffed animal plush toy soft', 'arts crafts kit girls boys',
    'puzzle 1000 pieces adults scenery', 'balance bike no pedal toddler',
    'kite easy fly kids large', 'wooden block set stacking toddler',
    'board game strategy two players', 'marble run set 100 pieces',
  ],
  'Clothing & Accessories': [
    'compression socks athletic 6 pack women', 'sun hat wide brim spf 50',
    'beanie hat knit unisex winter', 'fingerless gloves touchscreen',
    'face mask reusable washable 5 pack', 'belt leather reversible mens',
    'sunglasses polarized women uv400', 'reading glasses blue light blocking',
    'wallet slim men rfid blocking', 'tactical belt riggers heavy duty',
    'bandana cotton multi use pack', 'shoe insoles arch support cushion',
    'umbrella windproof automatic open', 'rain jacket packable lightweight',
    'thermal underwear base layer set', 'hiking socks merino wool cushion',
    'gloves touchscreen waterproof', 'neck gaiter balaclava face cover',
    'trucker hat mesh baseball cap', 'fanny pack waterproof waist bag',
  ],
  'Jewelry & Watches': [
    'minimalist bracelet women gold layering', 'watch band apple silicone replacement',
    'stud earrings set women hypoallergenic', 'anklet set layered women gold',
    'necklace pendant simple delicate gold', 'rings stacking set women adjustable',
    'jewelry organizer box velvet travel', 'watch display stand case holder',
    'silver polish cloth anti tarnish', 'earring organizer wall hanging',
    'men bracelet leather braided set', 'charm bracelet women pandora compatible',
    'birthstone necklace personalized', 'cuff bracelet adjustable women',
    'hair clip barrette set women', 'magnetic locket necklace floating',
    'jewelry cleaning solution kit', 'ring size adjuster guard set',
    'brooch pin vintage women', 'hair jewelry pins accessories wedding',
  ],
  'Office Supplies': [
    'desk organizer accessories set bamboo', 'ergonomic wrist rest mouse pad',
    'label maker tape printer handheld', 'stapler heavy duty 210 sheets',
    'pen holder organizer magnetic mesh', 'whiteboard magnetic dry erase 17x23',
    'planner agenda undated weekly', 'sticky notes 3x3 assorted colors',
    'scissors set multipurpose stainless', 'binder clips large assorted 60 pack',
    'hanging file folders letter size', 'printer paper 8.5x11 500 sheets',
    'tape dispenser weighted heavy duty', 'calculator scientific solar',
    'highlighter set dual tip pastel', 'correction tape white out roller',
    'rubber stamp custom self inking', 'paper tray letter desktop 3 tier',
    'index cards ruled 4x6 pack 500', 'push pins thumb tacks assorted',
  ],
  'Safety Gear': [
    'safety glasses protective clear ansi', 'first aid kit emergency home car',
    'safety vest reflective high visibility', 'hard hat vented construction',
    'work gloves mechanic heavy duty', 'respirator n95 particulate mask',
    'safety ear muffs noise reduction', 'knee pads construction flooring',
    'tool bag organizer canvas large', 'safety boots steel toe',
    'fire escape ladder 2 story', 'emergency kit car roadside',
    'smoke alarm detector battery', 'carbon monoxide detector plug in',
    'reflective road flares emergency', 'harness fall protection construction',
    'traffic cone collapsible safety', 'safety sign caution floor wet',
    'lock box key hide outdoor', 'personal alarm keychain emergency',
  ],
  'Industrial Equipment': [
    'multimeter digital professional clamp', 'soldering iron kit temperature control',
    'cable tracer toner network kit', 'pipe wrench heavy duty 14 inch',
    'drill bit set masonry concrete', 'saw blade circular 7.25 framing',
    'level laser self leveling 360', 'torque wrench 1/2 drive click',
    'wire stripper cutter crimper tool', 'stud finder electronic magnetic',
    'heat gun variable temperature', 'caulking gun sausage pack heavy',
    'utility knife box cutter retractable', 'duct tape heavy duty silver 3in',
    'sandpaper assorted grits 120 sheets', 'safety gloves cut resistant level 5',
    'bolt cutter 24 inch heavy hardened', 'pipe cutter copper pvc ratchet',
    'work light rechargeable portable led', 'magnetic pickup tool flexible',
  ],
  'Trading Cards': [
    'card sleeves standard size 200 pack', 'card binder 9 pocket 360 side loading',
    'card storage box 800 count', 'top loader rigid 3x4 100 pack',
    'penny sleeves 1000 pack clear', 'card grading holder one touch',
    'card display frame wall mount', 'card dividers tabs organizer',
    'toploaders 4x6 oversized cards', 'card sorting tray organizer',
    'card case screw down holder', 'pokemon card sleeve ultra pro',
    'trading card display stand counter', 'magnetic one touch 35pt holder',
    'card safe deposit box fireproof', 'grading submission kit supplies',
    'trading card album zippered portfolio', 'card texture cleaning cloth',
    'collector display shelf wall mounted', 'card UV protection case sleeve',
  ],
  'Coins & Currency': [
    'coin holder album collection book', 'magnifying glass loupe jeweler 30x',
    'coin capsules direct fit quarters', 'coin tubes half dollars storage',
    'currency album binder paper money', 'coin display case shadow box',
    'cleaning cloth silver jewelry polish', 'coin scale digital gram',
    'numismatic reference guide book', 'coin storage box lockable',
    'silver coin tongs non scratch', 'grading set coin holder snap',
    'coin photography mat backdrop', 'pcgs slab storage box',
    'round tube containers cents nickels', 'paper money sleeves currency',
    'jewelers loupe triplet 10x loupe', 'coin microscope digital usb',
    'bullion display stand bar holder', 'acid test kit gold silver',
  ],
  'Janitorial & Cleaning': [
    'heavy duty trash bags 55 gallon 50ct', 'paper towels bulk 12 rolls',
    'toilet paper bulk 30 rolls', 'hand soap refill gallon foaming',
    'dish soap commercial degreaser', 'floor cleaner concentrate gallon',
    'mop head replacement commercial cotton', 'broom dustpan set indoor',
    'janitorial cart cleaning supply', 'urinal screen deodorizer 10 pack',
    'air freshener spray can 12 pack', 'all purpose cleaner spray gallon',
    'laundry detergent pods 150 count', 'bleach tablets toilet bowl 48ct',
    'drain cleaner safe pipes enzyme', 'grease trap cleaner biological',
    'hand sanitizer gallon refill 70%', 'disinfectant wipes 400ct canister',
    'floor buffer pad scrubbing red', 'squeegee floor water push blade',
  ],
  'Packaging Materials': [
    'bubble mailers padded envelopes 6x10', 'poly mailers shipping bags 10x13',
    'cardboard boxes moving small 10pk', 'packing tape rolls clear heavy 6pk',
    'packing peanuts 14 cubic feet bag', 'tissue paper 100 sheets assorted',
    'kraft paper roll 17in wrapping', 'stretch wrap hand dispenser 18in',
    'fragile stickers labels roll 500', 'thank you cards stickers small biz',
    'padded mailers bubble lined bags', 'jewelry pouches small organza',
    'shipping scale postal 50lb digital', 'label printer thermal 4x6',
    'void fill paper rolls shredded', 'corner edge protectors cardboard',
    'security seal tamper evident bags', 'merchandise bags clear handles',
    'freezer zip bags gallon 150ct', 'heat sealer impulse machine 8 inch',
  ],
  'Sports Memorabilia': [
    'jersey display case frame shadow box', 'baseball card display case wall',
    'basketball case acrylic display stand', 'football helmet display stand',
    'autograph signing ball holder pen', 'memorabilia uv protection frame',
    'bobblehead display case shelf', 'sports photo frame 8x10 collage',
    'ball display holder crystal stand', 'collectible figure display shelf',
    'baseball bat display wall mount', 'pennant display frame shadow box',
    'sports medal holder display rack', 'ticket stub album holder display',
    'autographed item uv sleeves bags', 'memorabilia storage acid free',
    'glass display case countertop lock', 'trading card holder premium display',
    'sports trading card frame 4x6', 'collector storage cabinet lockable',
  ],
}

type RefreshOptions = {
  target?: number
  queryLimit?: number
  pages?: number[]
  timeoutMs?: number
}

function uniqueQueries(values: string[]) {
  const seen = new Set<string>()
  const queries: string[] = []

  for (const value of values) {
    const query = value.replace(/\s+/g, ' ').trim()
    const key = query.toLowerCase()
    if (!query || seen.has(key)) continue
    seen.add(key)
    queries.push(query)
  }

  return queries
}

function buildCatalogQueries(niche: string) {
  const baseQueries = NICHE_QUERIES[niche] || [`${niche} bestseller`]
  const nicheLower = niche.toLowerCase()
  const accessoriesQuery = nicheLower.includes('accessories') ? `${niche} kit` : `${niche} accessories`
  const categoryQueries = [
    `${niche} bestseller`,
    `${niche} best sellers`,
    `top rated ${niche}`,
    `popular ${niche}`,
    `trending ${niche}`,
    `high demand ${niche}`,
    `${niche} deals`,
    `${niche} under 25`,
    `${niche} under 50`,
    `${niche} bundle`,
    `${niche} pack`,
    `${niche} replacement`,
    `${niche} set`,
    `${niche} organizer`,
    `${niche} refill`,
    `${niche} parts`,
    `${niche} tools`,
    `${niche} small business`,
    accessoriesQuery,
  ]
  const modifierQueries = baseQueries.flatMap((query) => [
    query,
    `${query} best seller`,
    `${query} top rated`,
    `${query} pack`,
    `${query} replacement`,
  ])

  return uniqueQueries([...baseQueries, ...categoryQueries, ...modifierQueries])
}

// ── Refresh one niche in the product_cache table ─────────────────────────────
async function refreshNiche(niche: string, rapidKey: string, options: RefreshOptions = {}): Promise<number> {
  const target = Math.max(30, Math.min(CATALOG_NICHE_TARGET, options.target || STANDARD_NICHE_TARGET))
  const allQueries = buildCatalogQueries(niche)
  const queryLimit = options.queryLimit || Math.min(allQueries.length, 25)
  const queries = allQueries.slice(0, queryLimit)
  const pages = options.pages?.length ? options.pages : [1, 2]
  const timeoutMs = options.timeoutMs || 6000
  const results: Record<string, unknown>[] = []
  const seen = new Set<string>()

  // Build all (query, page) pairs then run in parallel batches of 5
  const tasks: Array<{ query: string; page: number }> = []
  for (const query of queries) {
    for (const page of pages) {
      tasks.push({ query, page })
    }
  }

  const PARALLEL = 5
  for (let i = 0; i < tasks.length; i += PARALLEL) {
    if (results.length >= target) break
    const batch = tasks.slice(i, i + PARALLEL)
    const settled = await Promise.allSettled(
      batch.map(({ query, page }) => scrapeAmazonSearch(query, page, timeoutMs))
    )
    for (const outcome of settled) {
      if (results.length >= target) break
      if (outcome.status !== 'fulfilled') continue
      for (const p of outcome.value) {
        const asin = String(p.asin || '')
        if (!asin || seen.has(asin)) continue
        seen.add(asin)
        const price = p.price
        const title = String(p.title || '')
        if (!price || price <= 0 || price > MAX_COST || !title || isRejected(title)) continue
        const { ebayPrice, profit, roi } = calcMetrics(price)
        if (profit < MIN_PROFIT) continue
        const risk = price > 150 ? 'HIGH' : price > 60 || roi < 45 ? 'MEDIUM' : 'LOW'
        results.push({ asin, title, amazonPrice: price, ebayPrice, profit, roi, imageUrl: p.imageUrl || '', risk, salesVolume: '', sourceNiche: niche, _rating: p.rating || 0, _numRatings: p.reviewCount || 0 })
        if (results.length >= target) break
      }
    }
  }

  if (results.length === 0) return 0
  results.sort((a, b) => {
    const s = (p: Record<string, unknown>) =>
      (p.profit as number) * Math.log10(Math.max(parseInt(String(p.salesVolume || '0').replace(/[^0-9]/g, ''), 10) || 1, 1) + 1)
        * ((p._rating as number || 3) / 5)
        * Math.log10((p._numRatings as number || 0) + 10)
    return s(b) - s(a)
  })

  try {
    await sql`INSERT INTO product_cache (niche, results, version) VALUES (${niche}, ${JSON.stringify(results.slice(0, target))}, ${CACHE_VERSION})
              ON CONFLICT (niche) DO UPDATE SET results = EXCLUDED.results, version = EXCLUDED.version, cached_at = NOW()`
  } catch { return 0 }
  return results.length
}

// ── Refresh one niche using direct Amazon scraping (no API key needed) ───────
async function refreshNicheScrape(niche: string, options: RefreshOptions = {}): Promise<number> {
  const target = Math.max(30, Math.min(CATALOG_NICHE_TARGET, options.target || STANDARD_NICHE_TARGET))
  const allQueries = buildCatalogQueries(niche)
  const queries = allQueries.slice(0, options.queryLimit || Math.min(allQueries.length, 20))
  const pages = options.pages?.length ? options.pages : [1, 2]
  const timeoutMs = options.timeoutMs || 6000
  const results: Record<string, unknown>[] = []
  const seen = new Set<string>()

  // Build all tasks then run in parallel batches of 3
  const tasks: Array<{ query: string; page: number }> = []
  for (const query of queries) {
    for (const page of pages) {
      tasks.push({ query, page })
    }
  }

  const PARALLEL = 3
  for (let i = 0; i < tasks.length; i += PARALLEL) {
    if (results.length >= target) break
    const batch = tasks.slice(i, i + PARALLEL)
    const settled = await Promise.allSettled(
      batch.map(({ query, page }) => scrapeAmazonSearch(query, page, timeoutMs))
    )
    for (const outcome of settled) {
      if (results.length >= target) break
      if (outcome.status !== 'fulfilled') continue
      for (const p of outcome.value) {
        if (!p.asin || seen.has(p.asin)) continue
        seen.add(p.asin)
        if (!p.price || p.price <= 0 || p.price > MAX_COST || !p.title || isRejected(p.title)) continue
        const { ebayPrice, profit, roi } = calcMetrics(p.price)
        if (profit < MIN_PROFIT) continue
        const risk = p.price > 150 ? 'HIGH' : p.price > 60 || roi < 45 ? 'MEDIUM' : 'LOW'
        results.push({ asin: p.asin, title: p.title, amazonPrice: p.price, ebayPrice, profit, roi,
          imageUrl: p.imageUrl, risk, salesVolume: '', sourceNiche: niche, _rating: p.rating, _numRatings: p.reviewCount })
        if (results.length >= target) break
      }
    }
    // Small delay to avoid Amazon rate limiting
    if (i + PARALLEL < tasks.length && results.length < target) {
      await new Promise(r => setTimeout(r, 300))
    }
  }

  if (results.length === 0) return 0
  results.sort((a, b) => {
    const s = (p: Record<string, unknown>) =>
      (p.profit as number) * ((p._rating as number || 3) / 5) * Math.log10((p._numRatings as number || 0) + 10)
    return s(b) - s(a)
  })
  try {
    await sql`INSERT INTO product_cache (niche, results, version) VALUES (${niche}, ${JSON.stringify(results.slice(0, target))}, ${CACHE_VERSION})
              ON CONFLICT (niche) DO UPDATE SET results = EXCLUDED.results, version = EXCLUDED.version, cached_at = NOW()`
  } catch { return 0 }
  return results.length
}

async function refreshContinuousCache(): Promise<number> {
  try {
    const rows = await queryRows<{ niche: string; results: Array<Record<string, unknown>> }>`
      SELECT niche, results
      FROM product_cache
      WHERE niche <> ${CONTINUOUS_CACHE_KEY}
      ORDER BY cached_at DESC
      LIMIT 120
    `
    const seen = new Set<string>()
    const products: Array<Record<string, unknown>> = []

    for (const row of rows) {
      const rowProducts = Array.isArray(row.results) ? row.results : []
      for (const product of rowProducts) {
        const asin = String(product.asin || '').toUpperCase()
        const title = String(product.title || '')
        if (!asin || seen.has(asin)) continue
        if (!title || isRejected(title)) continue
        seen.add(asin)
        const repriced = repriceCachedProduct({ ...product, asin }, row.niche)
        if (!repriced) continue
        products.push(repriced)
        if (products.length >= MAX_CONTINUOUS_POOL_SIZE) break
      }
      if (products.length >= MAX_CONTINUOUS_POOL_SIZE) break
    }

    if (products.length === 0) return 0
    products.sort((a, b) => {
      const score = (product: Record<string, unknown>) => {
        const profit = Number(product.profit) || 0
        const roi = Number(product.roi) || 0
        const rating = Number(product._rating) || 3.8
        const reviews = Number(product._numRatings) || 0
        return profit * Math.max(0.35, roi / 55) * Math.max(0.7, rating / 4.5) * Math.log10(reviews + 20)
      }
      return score(b) - score(a)
    })

    await sql`
      INSERT INTO product_cache (niche, results, version)
      VALUES (${CONTINUOUS_CACHE_KEY}, ${JSON.stringify(products)}, ${CACHE_VERSION})
      ON CONFLICT (niche) DO UPDATE SET results = EXCLUDED.results, version = EXCLUDED.version, cached_at = NOW()
    `
    return products.length
  } catch {
    return 0
  }
}

// ── Sync one user's eBay listings — mark ended/sold listings in DB ────────────
async function syncUserListings(userId: number) {
  const credentials = await getValidEbayAccessToken(String(userId))
  if (!credentials?.accessToken) return
  const token = credentials.accessToken

  // Collect all active eBay listing IDs via GetMyeBaySelling (paginated)
  const activeIds = new Set<string>()
  let fetchSucceeded = false
  const appId = process.env.EBAY_APP_ID || ''
  for (let page = 1; page <= 20; page++) {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials>
  <ActiveList><Include>true</Include><Pagination><EntriesPerPage>200</EntriesPerPage><PageNumber>${page}</PageNumber></Pagination></ActiveList>
  <OutputSelector>ActiveList.ItemArray.Item.ItemID,ActiveList.PaginationResult.TotalNumberOfPages</OutputSelector>
</GetMyeBaySellingRequest>`
    const res = await fetch('https://api.ebay.com/ws/api.dll', {
      method: 'POST',
      headers: { 'X-EBAY-API-CALL-NAME': 'GetMyeBaySelling', 'X-EBAY-API-SITEID': '0', 'X-EBAY-API-COMPATIBILITY-LEVEL': '967', 'X-EBAY-API-APP-NAME': appId, 'Authorization': `Bearer ${token}`, 'Content-Type': 'text/xml' },
      body: xml,
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return
    const text = await res.text()
    if (text.includes('<Ack>Failure</Ack>')) return
    fetchSucceeded = true
    const ids = [...text.matchAll(/<ItemID>(\d+)<\/ItemID>/g)].map(m => m[1])
    ids.forEach(id => activeIds.add(id))
    const totalPages = parseInt(text.match(/<TotalNumberOfPages>(\d+)<\/TotalNumberOfPages>/)?.[1] || '1', 10)
    if (page >= totalPages) break
  }

  if (!fetchSucceeded) return

  // Mark any listed ASIN whose eBay listing is no longer active
  const dbRows = await queryRows<{ id: number; ebay_listing_id: string }>`SELECT id, ebay_listing_id FROM listed_asins WHERE user_id = ${userId} AND ended_at IS NULL AND ebay_listing_id IS NOT NULL`
  const toEnd = dbRows.filter(r => !activeIds.has(String(r.ebay_listing_id)))
  if (toEnd.length > 0) {
    const ids = toEnd.map(r => r.id)
    await sql`UPDATE listed_asins SET ended_at = NOW() WHERE id = ANY(${ids})`
  }
}

// ── Cron handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })
  }

  // Ensure ended_at column exists
  await sql`ALTER TABLE listed_asins ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ`.catch(() => {})
  await sql`CREATE TABLE IF NOT EXISTS product_cache (niche TEXT PRIMARY KEY, results JSONB NOT NULL, cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), version INTEGER NOT NULL DEFAULT 1)`.catch(() => {})
  await sql`ALTER TABLE product_cache ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1`.catch(() => {})
  await ensureProductSourceTables().catch(() => {})

  const startedAt = Date.now()
  const report: Record<string, unknown> = {}
  const rollingRefresh = req.nextUrl.searchParams.get('rolling') === '1'
  const sourceOnly = req.nextUrl.searchParams.get('sourceOnly') === '1'
  const catalogRefresh = req.nextUrl.searchParams.get('catalog') === '1' || req.nextUrl.searchParams.get('deep') === '1'
  const fullRefresh = req.nextUrl.searchParams.get('full') === '1' || (!rollingRefresh && !catalogRefresh)
  const requestedBatchSize = Number(req.nextUrl.searchParams.get('batch') || '')
  const requestedStartIndex = Number(req.nextUrl.searchParams.get('start') || '')
  const now = new Date()

  if (sourceOnly) {
    // Re-fetch live Amazon prices for stale pool products, then reprice with updated costs
    report.priceRefresh = await refreshProductSourcePrices({ limit: 300, staleDays: 5 })
    report.repriced = await repriceProductSourceItems()
    report.sourceProducts = await rebuildProductSourceFromCache()
    report.continuousProducts = await refreshContinuousCache()
    report.durationMs = Date.now() - startedAt
    return apiOk({ success: true, ...report })
  }

  // 1. Sync eBay listing statuses for all users
  const shouldSyncUsers = !catalogRefresh && (fullRefresh || (now.getUTCMinutes() === 0 && now.getUTCHours() % 4 === 0))
  if (shouldSyncUsers) {
    try {
      const users = await queryRows<{ user_id: number }>`SELECT user_id FROM ebay_credentials`
      let synced = 0
      for (const u of users) {
        try { await syncUserListings(Number(u.user_id)); synced++ } catch { /* skip */ }
        if (Date.now() - startedAt > 120_000) break // stay within budget
      }
      report.usersSynced = synced
    } catch (e) { report.syncError = String(e) }
  } else {
    report.usersSynced = 'skipped'
  }

  // 2. Refresh product cache for all niches
  const rapidKey = process.env.RAPIDAPI_KEY
  const allNiches = Object.keys(NICHE_QUERIES)
  const targetProducts = catalogRefresh ? CATALOG_NICHE_TARGET : STANDARD_NICHE_TARGET
  const defaultBatchSize = catalogRefresh ? CATALOG_NICHE_BATCH_SIZE : (fullRefresh ? allNiches.length : SCHEDULED_NICHE_BATCH_SIZE)
  const batchSize = Math.max(1, Math.min(allNiches.length, Number.isFinite(requestedBatchSize) && requestedBatchSize > 0 ? Math.floor(requestedBatchSize) : defaultBatchSize))

  // For catalog refresh, pick the STALEST niches (least recently cached) so every
  // click covers different niches instead of repeating the same 3.
  let niches: string[]
  if (catalogRefresh && !Number.isFinite(requestedStartIndex)) {
    try {
      const cached = await queryRows<{ niche: string; cached_at: string }>`
        SELECT niche, cached_at FROM product_cache ORDER BY cached_at ASC
      `
      const cachedMap = new Map(cached.map(r => [r.niche, r.cached_at]))
      niches = [...allNiches]
        .sort((a, b) => {
          const aTime = cachedMap.has(a) ? new Date(cachedMap.get(a)!).getTime() : 0
          const bTime = cachedMap.has(b) ? new Date(cachedMap.get(b)!).getTime() : 0
          return aTime - bTime // oldest first
        })
        .slice(0, batchSize)
    } catch {
      niches = allNiches.slice(0, batchSize)
    }
  } else {
    const rotationMinutes = catalogRefresh ? 60 : 15
    const rotation = Math.floor(Date.now() / (rotationMinutes * 60 * 1000))
    const startIndex = Number.isFinite(requestedStartIndex) && requestedStartIndex >= 0
      ? Math.floor(requestedStartIndex) % allNiches.length
      : fullRefresh && !catalogRefresh ? 0 : (rotation * batchSize) % allNiches.length
    niches = Array.from({ length: Math.min(batchSize, allNiches.length) }, (_, index) => allNiches[(startIndex + index) % allNiches.length])
  }
  const rapidOptions = catalogRefresh
    ? { target: targetProducts, queryLimit: 6, pages: [1, 2], timeoutMs: 4500 }
    : { target: targetProducts, queryLimit: 4, pages: [1], timeoutMs: 8000 }
  const scrapeOptions = catalogRefresh
    ? { target: targetProducts, queryLimit: 4, pages: [1, 2], timeoutMs: 3500 }
    : { target: targetProducts, queryLimit: 3, pages: [1], timeoutMs: 6000 }
  const runProductRefresh = async () => {
    let refreshed = 0
    let quotaHit = false

    if (rapidKey) {
      for (const niche of niches) {
        if (quotaHit || Date.now() - startedAt > (catalogRefresh ? 165_000 : 200_000)) break
        const count = await refreshNiche(niche, rapidKey, rapidOptions)
        if (count === -1) { quotaHit = true; break }
        if (count > 0) refreshed++
        await new Promise(r => setTimeout(r, 200))
      }
    } else {
      quotaHit = true // no key = treat same as quota hit
    }

    // If quota hit, fill remaining niches via direct Amazon scrape
    if (quotaHit) {
      for (const niche of niches) {
        if (Date.now() - startedAt > (catalogRefresh ? 235_000 : 270_000)) break
        try {
          const count = await refreshNicheScrape(niche, scrapeOptions)
          if (count > 0) refreshed++
        } catch { /* skip */ }
        await new Promise(r => setTimeout(r, 500))
      }
    }

    return {
      nichesRefreshed: refreshed,
      nichesAttempted: niches,
      catalogRefresh,
      targetProductsPerNiche: targetProducts,
      batchSize,
      quotaHit,
      sourceProducts: await rebuildProductSourceFromCache(catalogRefresh ? 250 : 120),
      continuousProducts: await refreshContinuousCache(),
    }
  }

  if (catalogRefresh && req.nextUrl.searchParams.get('wait') !== '1') {
    report.fastCatalogRefresh = true
    report.liveFetchSkipped = 'Add wait=1 to run the slower live Amazon fetch loop.'
    report.nichesRefreshed = 'skipped'
    report.nichesAttempted = niches
    report.catalogRefresh = catalogRefresh
    report.targetProductsPerNiche = targetProducts
    report.batchSize = batchSize
    report.sourceProducts = await rebuildProductSourceFromCache(250)
    report.continuousProducts = await refreshContinuousCache()
    report.durationMs = Date.now() - startedAt
    return apiOk({ success: true, ...report })
  }

  Object.assign(report, await runProductRefresh())
  report.durationMs = Date.now() - startedAt
  return apiOk({ success: true, ...report })
}
