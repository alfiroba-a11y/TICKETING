const express = require('express');
const { MongoClient } = require('mongodb');
const { rateLimit } = require('express-rate-limit');
const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');
const crypto = require('node:crypto');
const path = require('node:path');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use((req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');next()});
const port=Number(process.env.PORT||3000);
const adminEmail=String(process.env.ADMIN_EMAIL||'').trim().toLowerCase();
const adminPassword=String(process.env.ADMIN_PASSWORD||'');
const adminConfigured=Boolean(adminEmail&&adminPassword&&String(process.env.SESSION_SECRET||'').length>=32);
// Keep the public app bootable before admin credentials are configured. The
// generated secret is process-local, and admin endpoints remain disabled.
const sessionSecret=String(process.env.SESSION_SECRET||'')||crypto.randomBytes(48).toString('hex');
const mongoUri=String(process.env.MONGODB_URI||'');
const mongoDbName=String(process.env.MONGODB_DATABASE||'ticketing_kenya');
const hashpayAccount=String(process.env.HASHPAY_ACCOUNT_ID||'');
const webhookSecret=String(process.env.HASHPAY_WEBHOOK_SECRET||'');
const client=mongoUri?new MongoClient(mongoUri,{appName:'ticketing-kenya'}):null;
let databaseReady=false;

const userImages={stadium:'/images/talanta-stadium-exterior.png',pitch:'/images/stadium-seating.png',theatre:'/images/theatre-seating.png',cinema:'/images/cinema-auditorium.png',snacks:'/images/cinema-concessions.png'};
const venueSeeds=[
 ['talanta','Talanta Sports Stadium','stadium','Nairobi','Nairobi',60000,'sports','https://sports.go.ke/'],
 ['kasarani','Moi International Sports Centre — Kasarani','stadium','Nairobi','Nairobi',60000,'sports','https://footballkenya.org/sportpesa-league/stadiums'],
 ['nyayo','Nyayo National Stadium','stadium','Nairobi','Nairobi',30000,'sports','https://www.sportskenya.org/index.php/financing/our-facilities/63-nyayo-national-stadium'],
 ['bukhungu','Bukhungu Stadium','stadium','Kakamega','Kakamega',12000,'sports','https://footballkenya.org/sportpesa-league/stadiums'],
 ['moi-kisumu','Moi Stadium Kisumu','stadium','Kisumu','Kisumu',10000,'sports','https://footballkenya.org/sportpesa-league/stadiums'],
 ['gusii','Gusii Stadium','stadium','Kisii','Kisii',10000,'sports','https://footballkenya.org/sportpesa-league/stadiums'],
 ['afraha','Afraha Stadium','stadium','Nakuru','Nakuru',8200,'sports','https://footballkenya.org/sportpesa-league/stadiums'],
 ['ulinzi','Ulinzi Sports Complex','stadium','Nairobi','Nairobi',4000,'sports','https://footballkenya.org/sportpesa-league/stadiums'],
 ['mbaraki','Mbaraki Sports Club','stadium','Mombasa','Mombasa',5000,'sports','https://footballkenya.org/sportpesa-league/stadiums'],
 ['moi-embu','Moi Stadium Embu','stadium','Embu','Embu',null,'sports','https://sports.go.ke/sites/default/files/Downloads/DRAFT%20SPORTS%20SUBSECTOR%20REPORT%20SEPTEMBER%202025.pdf'],
 ['kipchoge','Kipchoge Keino Stadium','stadium','Eldoret','Uasin Gishu',null,'sports','https://footballkenya.org/sportpesa-league/stadiums'],
 ['city-stadium','Nairobi City Stadium','stadium','Nairobi','Nairobi',null,'sports','https://kickstartkenyafootball.com/land-audit'],
 ['bomas','Bomas of Kenya auditorium','theatre','Nairobi','Nairobi',null,'arts','https://www.bomasofkenya.go.ke/'],
 ['national-theatre','Kenya National Theatre — Main Auditorium','theatre','Nairobi','Nairobi',430,'arts','https://www.kenyaculturalcentre.go.ke/wp-content/uploads/2025/02/Booking-Rates.pdf'],
 ['ukumbi-mdogo','Kenya National Theatre — Ukumbi Mdogo','theatre','Nairobi','Nairobi',150,'arts','https://www.kenyaculturalcentre.go.ke/wp-content/uploads/2025/02/Booking-Rates.pdf'],
 ['little-theatre','Little Theatre Club','theatre','Mombasa','Mombasa',null,'arts','https://littletheatre.club/about'],
 ['century-sarit','Century Cinemax — Sarit Centre','cinema','Nairobi','Nairobi',null,'cinema','https://centurycinemax.co.ke/'],
 ['century-garden-city','Century Cinemax — Garden City Mall','cinema','Nairobi','Nairobi',null,'cinema','https://centurycinemax.co.ke/'],
 ['century-two-rivers','Century Cinemax — Two Rivers Mall','cinema','Nairobi','Kiambu',null,'cinema','https://centurycinemax.co.ke/'],
 ['century-junction','Century Cinemax — The Junction Mall','cinema','Nairobi','Nairobi',null,'cinema','https://centurycinemax.co.ke/'],
 ['anga-sky','Anga Sky Cinema — Panari','cinema','Nairobi','Nairobi',null,'cinema','https://cinema.angacinemas.com/sky'],
 ['anga-diamond','Anga Diamond Cinema','cinema','Nairobi','Nairobi',null,'cinema','https://cinema.angacinemas.com/diamond'],
 ['nyali-cinemax','Nyali Cinemax','cinema','Mombasa','Mombasa',null,'cinema','https://www.nyalicinemax.com/'],
 ['af-wangari','Alliance Française — Wangari Maathai Auditorium','theatre','Nairobi','Nairobi',196,'arts','https://afkenya.org/facilities/'],
 ['nakuru-players','Nakuru Players Theatre','theatre','Nakuru','Nakuru',null,'arts','https://new-heva-fund.squarespace.com/s/CASiK-Network-Members.pdf']
];
function baseSections(id){
 if(id==='talanta')return [{name:'Lower Tier',label:'Lower bowl',rows:0,seatsPerRow:0},{name:'Upper Tier',label:'Upper bowl',rows:0,seatsPerRow:0},{name:'VIP',label:'Hospitality seating',rows:0,seatsPerRow:0},{name:'VVIP',label:'Hospitality suites',rows:0,seatsPerRow:0}];
 if(id==='kasarani')return [{name:'Lower Deck',label:'Lower grandstand',rows:0,seatsPerRow:0},{name:'Upper Deck',label:'Upper grandstand',rows:0,seatsPerRow:0},{name:'VIP',label:'VIP section',rows:0,seatsPerRow:0},{name:'VVIP',label:'VVIP section',rows:0,seatsPerRow:0}];
 if(id==='nyayo')return [{name:'Main Stand',label:'Main grandstand',rows:0,seatsPerRow:0},{name:'Open Stand',label:'Open stand',rows:0,seatsPerRow:0},{name:'VIP',label:'VIP section',rows:0,seatsPerRow:0},{name:'VVIP',label:'VVIP section',rows:0,seatsPerRow:0}];
 if(id==='anga-sky')return [{name:'Auditorium',label:'Rows A–J (row count supplied; seat count needs confirmation)',rows:10,seatsPerRow:0}];
 if(id.startsWith('century-')||id==='anga-diamond'||id==='nyali-cinemax')return [{name:'Standard',label:'Standard auditorium seating',rows:0,seatsPerRow:0},{name:'Premium',label:'Premium/recliner seating where available',rows:0,seatsPerRow:0},{name:'D-Box',label:'Motion seating only where venue confirms',rows:0,seatsPerRow:0}];
 return [];
}
function baseGates(id){if(id==='talanta')return ['A','B','C','D'].map(n=>({name:'Gate '+n,label:'User-supplied reference; confirm exact gate assignment with event organizer'}));if(id==='kasarani')return Array.from({length:12},(_,i)=>({name:'Gate '+(i+1),label:'Historical/user-supplied reference; reconfirm for event'}));return []}
function mongoEvent(e,venue){return {id:String(e._id),title:e.title,description:e.description||'',category:e.category,venue_id:e.venueId,venue_name:venue?.name||'',venue_town:venue?.town||'',venue_kind:venue?.kind||'',layout_status:venue?.layoutStatus||'needs_verification',venueSections:venue?.sections||[],venueGates:venue?.gates||[],starts_at:e.startsAt,ends_at:e.endsAt||null,status:e.status,ticketTypes:(e.ticketTypes||[]).map(t=>({id:t.id,name:t.name,price:t.price,quantity:t.quantity,section_name:t.section,gate_name:t.gate,seat_mode:t.seatMode}))}}
function b64(x){return Buffer.from(x).toString('base64url')}
function sig(x){return crypto.createHmac('sha256',sessionSecret).update(x).digest('base64url')}
function safeEqual(a,b){return crypto.timingSafeEqual(crypto.createHash('sha256').update(String(a)).digest(),crypto.createHash('sha256').update(String(b)).digest())}
function cookie(req,n){const c=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(n+'='));return c?decodeURIComponent(c.slice(n.length+1)):''}
function adminSession(req){try{const[p,s]=cookie(req,'tk_admin').split('.');if(!p||!s||!safeEqual(s,sig(p)))return false;const d=JSON.parse(Buffer.from(p,'base64url').toString());return d.email===adminEmail&&d.exp>Date.now()}catch{return false}}
function requireAdmin(req,res,next){if(!adminSession(req))return res.status(401).json({error:'Sign in required.'});next()}
function sameOrigin(req,res,next){const origin=req.get('origin');if(!origin)return res.status(403).json({error:'Request origin required.'});const proto=req.get('x-forwarded-proto')?.split(',')[0]||req.protocol;if(origin!==`${proto}://${req.get('host')}`)return res.status(403).json({error:'Request origin rejected.'});next()}
function cleanTypes(items,required){if(!Array.isArray(items)||items.length>30)throw Error('Use no more than 30 ticket formats.');const complete=items.filter(t=>String(t.name||'').trim()||String(t.price??'')||String(t.quantity??''));if(required&&!complete.length)throw Error('Add at least one complete ticket format.');return complete.map(t=>{const name=String(t.name||'').trim().slice(0,80),price=Number(t.price),quantity=Number(t.quantity),section=String(t.section||'General admission').trim().slice(0,80);if(!name||!Number.isSafeInteger(price)||price<0||!Number.isSafeInteger(quantity)||quantity<1)throw Error('Each ticket format needs a name, whole-shilling price and positive quantity.');return{id:String(t.id||crypto.randomUUID()),name,price,quantity,section,gate:String(t.gate||'').trim().slice(0,80),seatMode:['numbered','unassigned'].includes(t.seatMode)?t.seatMode:'unassigned'}})}
function eventInput(body){const title=String(body.title||'').trim().slice(0,140),description=String(body.description||'').trim().slice(0,3000),category=String(body.category||'Other'),venueId=String(body.venueId||''),startsAt=String(body.startsAt||''),endsAt=body.endsAt?String(body.endsAt):null;if(!title||!['Sports','Cinema','Music','Arts & Theatre','Family','Other'].includes(category)||!Number.isFinite(Date.parse(startsAt)))throw Error('Complete the event name, category and start time.');if(endsAt&&!Number.isFinite(Date.parse(endsAt)))throw Error('End time is invalid.');if(body.status==='published'&&(!endsAt||Date.parse(endsAt)<=Date.parse(startsAt)))throw Error('Set an end time after the start before publishing.');return{title,description,category,venueId,startsAt:new Date(startsAt).toISOString(),endsAt:endsAt?new Date(endsAt).toISOString():null,ticketTypes:cleanTypes(body.ticketTypes,body.status==='published')}}
function validateNumberedLayout(types,venue){for(const t of types.filter(x=>x.seatMode==='numbered')){const s=(venue.sections||[]).find(x=>x.name===t.section);if(venue.layoutStatus!=='venue_verified'||!Number(s?.rows)||!Number(s?.seatsPerRow))throw Error(`Confirm the ${t.section} seat map and enter rows and seats per row before publishing numbered tickets.`)}}
async function eventOut(doc){const venue=await collections.venues.findOne({_id:doc.venueId});return mongoEvent(doc,venue)}
async function syncInventory(event,venue){
 const inv=collections.inventory;const newIds=(event.ticketTypes||[]).map(t=>t.id);
 await inv.updateMany({eventId:String(event._id),status:'available',tierId:{$nin:newIds}},{ $set:{status:'disabled'} });
 for(const tier of event.ticketTypes||[]){
  if(tier.seatMode==='numbered'){
   const sec=(venue.sections||[]).find(s=>s.name===tier.section),rows=Number(sec?.rows)||0,per=Number(sec?.seatsPerRow)||0;
   if(venue.layoutStatus!=='venue_verified'||!rows||!per)throw Error(`The ${tier.section} seating map needs confirmed row and seat counts before numbered tickets can be published.`);
    const validKeys=[];
    for(let r=0;r<rows;r++)for(let n=1;n<=per;n++){const row=String.fromCharCode(65+(r%26))+(r>=26?Math.floor(r/26):'');const seatCode=`${tier.section} · ${row}${String(n).padStart(2,'0')}`;validKeys.push(seatCode);await inv.updateOne({eventId:String(event._id),tierId:tier.id,inventoryKey:seatCode},{$setOnInsert:{eventId:String(event._id),tierId:tier.id,inventoryKey:seatCode,seatCode,section:tier.section,gate:tier.gate||'',status:'available'}},{upsert:true})}
    await inv.updateMany({eventId:String(event._id),tierId:tier.id,status:'available',inventoryKey:{$nin:validKeys}},{$set:{status:'disabled'}});
  }else{
    await inv.updateMany({eventId:String(event._id),tierId:tier.id,status:'available',inventoryKey:{$regex:/^GA-/}},{$set:{status:'disabled'}});
   for(let n=1;n<=tier.quantity;n++){const key=`GA-${String(n).padStart(5,'0')}`;await inv.updateOne({eventId:String(event._id),tierId:tier.id,inventoryKey:key},{$setOnInsert:{eventId:String(event._id),tierId:tier.id,inventoryKey:key,seatCode:'General admission',section:tier.section,gate:tier.gate||'',status:'available'}},{upsert:true})}
  }
 }
}
const loginLimiter=rateLimit({windowMs:15*60*1000,limit:8,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Too many sign-in attempts. Try again in 15 minutes.'}});

// Start the HTTP server independently of optional services. Coolify can route
// to the homepage while MongoDB/admin/payment setup is still in progress.
app.use(express.json({limit:'96kb'}));
app.use('/images',express.static(path.join(__dirname,'images'),{maxAge:'7d',immutable:true}));
app.get('/health',(req,res)=>res.status(200).json({ok:true,database:databaseReady?'connected':'not_configured_or_unavailable'}));
app.get('/api/config',(req,res)=>res.json({paymentsEnabled:Boolean(databaseReady&&hashpayAccount&&webhookSecret),hashpayAccount:hashpayAccount||null,databaseReady,adminConfigured}));
app.use('/api', (req,res,next)=>databaseReady?next():res.status(503).json({error:client?'Database is connecting or unavailable.':'MongoDB is not configured; data features are temporarily unavailable.'}));
app.get('/',(req,res)=>res.sendFile(path.join(__dirname,'index.html')));
app.get('/admin',(req,res)=>res.sendFile(path.join(__dirname,'index.html')));
app.listen(port,'0.0.0.0',()=>console.log(`Ticketing Kenya web server listening on port ${port}`));

async function start(){
 if(!client){console.warn('MongoDB is not configured. Public shell is running; event, booking, and admin data services are unavailable.');return}
 await client.connect();const db=client.db(mongoDbName);
 collections={venues:db.collection('tk_venues'),events:db.collection('tk_events'),inventory:db.collection('tk_event_inventory'),orders:db.collection('tk_orders'),tickets:db.collection('tk_tickets')};
 await Promise.all([collections.venues.createIndex({slug:1},{unique:true}),collections.events.createIndex({status:1,startsAt:1}),collections.inventory.createIndex({eventId:1,tierId:1,inventoryKey:1},{unique:true}),collections.inventory.createIndex({eventId:1,tierId:1,status:1}),collections.orders.createIndex({reference:1},{unique:true}),collections.orders.createIndex({accessHash:1}),collections.tickets.createIndex({ticketCode:1},{unique:true}),collections.tickets.createIndex({orderId:1,index:1},{unique:true})]);
 const now=new Date().toISOString();
 for(const [id,name,kind,town,county,capacity,category,sourceUrl] of venueSeeds){const doc={_id:id,slug:id,name,kind,town,county,capacity,category,sourceUrl,image:kind==='cinema'?userImages.cinema:kind==='stadium'?userImages.stadium:userImages.theatre,layoutStatus:'needs_verification',sections:baseSections(id),gates:baseGates(id),features:[],createdAt:now,updatedAt:now};await collections.venues.updateOne({_id:id},{$setOnInsert:doc})}
 app.post('/api/payments/hashpay/webhook',express.raw({type:'application/json',limit:'64kb'}),async(req,res)=>{
  try{if(!webhookSecret)return res.status(503).send('Webhook not configured');const raw=req.body,supplied=String(req.get('x-hashpay-signature')||''),expected='sha256='+crypto.createHmac('sha256',webhookSecret).update(raw).digest('hex');if(!safeEqual(supplied,expected))return res.status(401).send('Invalid signature');const p=JSON.parse(raw.toString());if(p.event!=='payment.success'||Number(p.ResponseCode)!==0)return res.status(200).send('OK');if(hashpayAccount&&String(p.AccountID)!==hashpayAccount)return res.status(401).send('Account mismatch');const ref=String(p.TransactionReference||'');const order=await collections.orders.findOne({reference:ref});if(!order)return res.status(404).send('Order not found');if(Number(p.TransactionAmount)!==Number(order.amount))return res.status(400).send('Amount mismatch');if(order.status==='paid')return res.status(200).send('OK');if(order.status!=='pending')return res.status(200).send('Order no longer fulfillable');
   const holds=await collections.inventory.find({orderId:order._id,status:'held'}).toArray();if(holds.length!==order.items.length){await collections.orders.updateOne({_id:order._id,status:'pending'},{$set:{status:'payment_review',paymentReviewReason:'Seat hold expired before payment confirmation',updatedAt:new Date()}});return res.status(200).send('Payment received; order requires review')}
   const tickets=order.items.map((item,index)=>({_id:`${order._id}-${index+1}`,orderId:order._id,index:index+1,ticketCode:crypto.randomBytes(9).toString('hex').toUpperCase(),eventId:order.eventId,eventTitle:order.eventTitle,eventCategory:order.eventCategory,venueName:order.venueName,venueTown:order.venueTown,startsAt:order.startsAt,attendee:item.attendee,tierName:item.tierName,price:item.price,section:item.section,seatCode:item.seatCode,gate:item.gate,receipt:String(p.TransactionReceipt||p.TransactionID||''),status:'valid',createdAt:new Date()}));
   try{await collections.tickets.insertMany(tickets,{ordered:true})}catch(err){if(err.code!==11000)throw err}
   await collections.inventory.updateMany({orderId:order._id,status:'held'},{$set:{status:'sold',soldAt:new Date()}});
   await collections.orders.updateOne({_id:order._id,status:'pending'},{$set:{status:'paid',receipt:String(p.TransactionReceipt||p.TransactionID||''),paidAt:new Date(),updatedAt:new Date()}});return res.status(200).send('OK')
  }catch(e){console.error('HashPay webhook error:',e.message);return res.status(500).send('Webhook processing error')}
 });
  databaseReady=true;
  app.post('/api/admin/login',loginLimiter,(req,res)=>{if(!adminConfigured)return res.status(503).json({error:'Admin access is disabled until ADMIN_EMAIL, ADMIN_PASSWORD and a 32+ character SESSION_SECRET are configured.'});const email=String(req.body.email||'').trim().toLowerCase(),password=String(req.body.password||'');if(!safeEqual(email,adminEmail)||!safeEqual(password,adminPassword))return res.status(401).json({error:'Email or password is incorrect.'});const payload=b64(JSON.stringify({email:adminEmail,exp:Date.now()+8*60*60*1000})),secure=process.env.NODE_ENV==='production'?'; Secure':'';res.setHeader('Set-Cookie',`tk_admin=${encodeURIComponent(payload+'.'+sig(payload))}; HttpOnly${secure}; SameSite=Strict; Path=/; Max-Age=28800`);res.json({ok:true})});
 app.get('/api/admin/session',(req,res)=>res.json({authenticated:adminSession(req)}));
 app.post('/api/admin/logout',sameOrigin,requireAdmin,(req,res)=>{const secure=process.env.NODE_ENV==='production'?'; Secure':'';res.setHeader('Set-Cookie',`tk_admin=; HttpOnly${secure}; SameSite=Strict; Path=/; Max-Age=0`);res.json({ok:true})});
 app.get('/api/venues',async(req,res)=>res.json((await collections.venues.find({}).sort({category:1,name:1}).toArray()).map(v=>({id:v._id,name:v.name,kind:v.kind,town:v.town,county:v.county,capacity:v.capacity,category:v.category,image:v.image,layoutStatus:v.layoutStatus,sections:v.sections||[],gates:v.gates||[],features:v.features||[]}))));
 app.get('/api/events',async(req,res)=>{const now=new Date(),query={status:'published'};if(req.query.scope==='current'){query.startsAt={$lte:now.toISOString()};query.endsAt={$gte:now.toISOString()}}else query.startsAt={$gt:now.toISOString()};if(req.query.category)query.category=String(req.query.category);const docs=await collections.events.find(query).sort({startsAt:1}).toArray();res.json(await Promise.all(docs.map(eventOut)))});
 app.get('/api/events/:id',async(req,res)=>{const e=await collections.events.findOne({_id:req.params.id,status:'published'});if(!e)return res.status(404).json({error:'Event not found.'});const out=await eventOut(e);if(req.query.detail==='full'){const seats=await collections.inventory.find({eventId:e._id,status:'available'}).project({tierId:1,seatCode:1,section:1,gate:1,_id:0}).toArray();out.availableSeats=seats}res.json(out)});
 app.get('/api/events/:id/seats',async(req,res)=>{const event=await collections.events.findOne({_id:req.params.id,status:'published'});if(!event)return res.status(404).json({error:'Event not found.'});const tier=(event.ticketTypes||[]).find(t=>t.id===String(req.query.tier));if(!tier)return res.status(404).json({error:'Ticket format not found.'});await collections.inventory.updateMany({eventId:event._id,tierId:tier.id,status:'held',holdExpiresAt:{$lte:new Date()}},{$set:{status:'available'},$unset:{orderId:'',holdExpiresAt:''}});const seats=await collections.inventory.find({eventId:event._id,tierId:tier.id,status:'available'}).project({inventoryKey:1,seatCode:1,section:1,gate:1,_id:0}).toArray();res.json({seatMode:tier.seatMode,seats})});
 app.get('/api/admin/events',requireAdmin,async(req,res)=>{const docs=await collections.events.find({}).sort({startsAt:1}).toArray();res.json(await Promise.all(docs.map(eventOut)))});
 app.post('/api/admin/events',sameOrigin,requireAdmin,async(req,res)=>{try{const v=eventInput(req.body),id=crypto.randomUUID(),status=req.body.status==='published'?'published':'draft',venue=await collections.venues.findOne({_id:v.venueId});if(!venue)return res.status(400).json({error:'Choose a listed venue.'});if(status==='published')validateNumberedLayout(v.ticketTypes,venue);const d={_id:id,...v,status,createdAt:new Date(),updatedAt:new Date()};await collections.events.insertOne(d);if(status==='published')await syncInventory(d,venue);res.status(201).json({id})}catch(e){res.status(400).json({error:e.message})}});
 app.put('/api/admin/events/:id',sameOrigin,requireAdmin,async(req,res)=>{try{const v=eventInput(req.body),venue=await collections.venues.findOne({_id:v.venueId}),old=await collections.events.findOne({_id:req.params.id});if(!old)return res.status(404).json({error:'Event not found.'});if(!venue)return res.status(400).json({error:'Choose a listed venue.'});const status=['published','cancelled'].includes(req.body.status)?req.body.status:'draft';if(status==='published')validateNumberedLayout(v.ticketTypes,venue);if(await collections.orders.countDocuments({eventId:old._id,status:{$in:['pending','paid','payment_review']}})&&status==='published')throw Error('This event has orders. Ticket inventory and layout can no longer be changed from this form.');const d={...old,...v,status,updatedAt:new Date()};await collections.events.replaceOne({_id:old._id},d);if(status==='published')await syncInventory(d,venue);res.json({ok:true})}catch(e){res.status(400).json({error:e.message})}});
 app.delete('/api/admin/events/:id',sameOrigin,requireAdmin,async(req,res)=>{const count=await collections.orders.countDocuments({eventId:req.params.id,status:{$in:['pending','paid','payment_review']}});if(count)return res.status(409).json({error:'This event has active or paid orders and cannot be deleted.'});await Promise.all([collections.events.deleteOne({_id:req.params.id}),collections.inventory.deleteMany({eventId:req.params.id})]);res.json({ok:true})});
 app.get('/api/admin/venues',requireAdmin,async(req,res)=>{const vs=await collections.venues.find({}).sort({category:1,name:1}).toArray();res.json(vs.map(v=>({...v,id:v._id})))});
 app.post('/api/admin/venues',sameOrigin,requireAdmin,async(req,res)=>{const name=String(req.body.name||'').trim().slice(0,140),town=String(req.body.town||'').trim().slice(0,80),county=String(req.body.county||'').trim().slice(0,80),kind=String(req.body.kind||'other'),sourceUrl=String(req.body.sourceUrl||'').trim().slice(0,500);if(!name||!town)return res.status(400).json({error:'Enter a venue name and town.'});if(sourceUrl&&!/^https:\/\//i.test(sourceUrl))return res.status(400).json({error:'Source URL must use HTTPS.'});const id=crypto.randomUUID();await collections.venues.insertOne({_id:id,slug:id,name,town,county,kind,category:kind==='stadium'?'sports':kind==='cinema'?'cinema':'arts',sourceUrl,image:'',layoutStatus:'needs_verification',sections:[],gates:[],features:[],createdAt:new Date(),updatedAt:new Date()});res.status(201).json({id})});
 app.put('/api/admin/venues/:id/layout',sameOrigin,requireAdmin,async(req,res)=>{const gates=Array.isArray(req.body.gates)?req.body.gates:[],sections=Array.isArray(req.body.sections)?req.body.sections:[];if(gates.length>100||sections.length>500)return res.status(400).json({error:'Layout is too large.'});const gateDocs=gates.map(g=>({name:String(g.name||'').trim().slice(0,80),label:String(g.label||'').trim().slice(0,160)})).filter(g=>g.name);const sectionDocs=sections.map(s=>({name:String(s.name||'').trim().slice(0,80),label:String(s.label||'').trim().slice(0,160),rows:Math.max(0,Math.min(500,Number(s.rows)||0)),seatsPerRow:Math.max(0,Math.min(500,Number(s.seatsPerRow)||0))})).filter(s=>s.name);const status=String(req.body.layoutStatus||'organizer_configured');if(!['needs_verification','organizer_configured','venue_verified'].includes(status))return res.status(400).json({error:'Unknown layout status.'});const r=await collections.venues.updateOne({_id:req.params.id},{$set:{gates:gateDocs,sections:sectionDocs,layoutStatus:status,updatedAt:new Date()}});if(!r.matchedCount)return res.status(404).json({error:'Venue not found.'});res.json({ok:true})});
 app.post('/api/orders',sameOrigin,async(req,res)=>{
  if(!hashpayAccount||!webhookSecret)return res.status(503).json({error:'HashPay is not configured for this deployment yet.'});
  let holdId='';
  try{
   const event=await collections.events.findOne({_id:String(req.body.eventId),status:'published'});if(!event)return res.status(404).json({error:'Event not found.'});
   const tier=(event.ticketTypes||[]).find(t=>t.id===String(req.body.tierId));if(!tier)return res.status(400).json({error:'Ticket format not found.'});
   const attendees=Array.isArray(req.body.attendees)?req.body.attendees:[];if(attendees.length<1||attendees.length>8)throw Error('Choose between 1 and 8 tickets.');
   for(const a of attendees){if(!String(a.name||'').trim()||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(a.email||'')))throw Error('Enter each attendee’s name and a valid email.')}
   const venue=await collections.venues.findOne({_id:event.venueId}),phone=String(req.body.phone||'').trim();if(!/^\+?254[17]\d{8}$|^0[17]\d{8}$/.test(phone))throw Error('Enter a valid Kenyan M-Pesa number.');
   holdId=crypto.randomUUID();const reference='TK'+crypto.randomBytes(8).toString('hex').toUpperCase(),accessToken=crypto.randomBytes(32).toString('hex'),expiresAt=new Date(Date.now()+10*60*1000),amount=tier.price*attendees.length;
   await collections.inventory.updateMany({eventId:event._id,tierId:tier.id,status:'held',holdExpiresAt:{$lte:new Date()}},{$set:{status:'available'},$unset:{orderId:'',holdExpiresAt:''}});
   let seatChoices=[];
   if(tier.seatMode==='numbered'){
    if(Array.isArray(req.body.seats)&&req.body.seats.length){if(req.body.seats.length!==attendees.length)throw Error('Choose one seat per attendee.');seatChoices=req.body.seats.map(String);if(new Set(seatChoices).size!==seatChoices.length)throw Error('Choose a different seat for each attendee.')}
    else seatChoices=(await collections.inventory.aggregate([{$match:{eventId:event._id,tierId:tier.id,status:'available'}},{$sample:{size:attendees.length}}]).toArray()).map(s=>s.inventoryKey);
    if(seatChoices.length!==attendees.length)throw Error('Not enough seats remain in that section.');
   }
   const claimed=[],items=[];
   for(let i=0;i<attendees.length;i++){
    let result;
    if(tier.seatMode==='numbered')result=await collections.inventory.findOneAndUpdate({eventId:event._id,tierId:tier.id,inventoryKey:seatChoices[i],status:'available'},{$set:{status:'held',orderId:holdId,holdExpiresAt:expiresAt}},{returnDocument:'after'});
    else result=await collections.inventory.findOneAndUpdate({eventId:event._id,tierId:tier.id,status:'available'},{$set:{status:'held',orderId:holdId,holdExpiresAt:expiresAt}},{sort:{inventoryKey:1},returnDocument:'after'});
    const inv=result?.value||result;if(!inv)throw Error('A selected seat or ticket was just taken. Choose another option.');claimed.push(inv._id);
    items.push({attendee:{name:String(attendees[i].name).trim().slice(0,100),email:String(attendees[i].email).trim().slice(0,180)},tierId:tier.id,tierName:tier.name,price:tier.price,section:inv.section||tier.section,seatCode:inv.seatCode,gate:inv.gate||tier.gate||''});
   }
   await collections.orders.insertOne({_id:holdId,reference,eventId:event._id,eventTitle:event.title,eventCategory:event.category,venueName:venue.name,venueTown:venue.town,startsAt:event.startsAt,amount,currency:'KES',phone,items,status:'pending',inventoryIds:claimed,accessHash:crypto.createHash('sha256').update(accessToken).digest('hex'),expiresAt,createdAt:new Date(),updatedAt:new Date()});
   res.status(201).json({orderId:holdId,reference,accessToken,amount,expiresAt:expiresAt.toISOString(),hashpayAccount,phone});
  }catch(e){if(holdId)await collections.inventory.updateMany({orderId:holdId,status:'held'},{$set:{status:'available'},$unset:{orderId:'',holdExpiresAt:''}});const code=/seat|ticket|attendee|email|number|M-Pesa|Choose/.test(e.message)?409:400;res.status(code).json({error:e.message})}
 });
 app.get('/api/orders/:id',async(req,res)=>{const order=await accessOrder(req.params.id,req.query.token);if(!order)return res.status(404).json({error:'Order not found.'});if(order.status==='pending'&&order.expiresAt<=new Date()){await collections.orders.updateOne({_id:order._id,status:'pending'},{$set:{status:'expired',updatedAt:new Date()}});await collections.inventory.updateMany({orderId:order._id,status:'held'},{$set:{status:'available'},$unset:{orderId:'',holdExpiresAt:''}});order.status='expired'}res.json({id:order._id,reference:order.reference,status:order.status,amount:order.amount,expiresAt:order.expiresAt,items:order.status==='paid'?await collections.tickets.find({orderId:order._id}).sort({index:1}).toArray():[],message:order.status==='pending'?'Approve the M-Pesa prompt on your phone.':order.status==='payment_review'?'Payment received. Support is checking the seat hold.':''})});
 app.get('/api/orders/:id/tickets.pdf',async(req,res)=>{const order=await accessOrder(req.params.id,req.query.token);if(!order||order.status!=='paid')return res.status(403).json({error:'Paid tickets are not available.'});const tickets=await collections.tickets.find({orderId:order._id}).sort({index:1}).toArray();res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`attachment; filename="Ticketing-Kenya-${order.reference}.pdf"`);const doc=new PDFDocument({size:[420,595],margin:0,autoFirstPage:false});doc.pipe(res);const base=process.env.PUBLIC_BASE_URL||`${req.protocol}://${req.get('host')}`;for(const t of tickets){doc.addPage();await drawTicketPdf(doc,t,base)}doc.end()});
 app.get('/api/tickets/:code/qr.png',async(req,res)=>{const t=await collections.tickets.findOne({ticketCode:req.params.code,status:'valid'});if(!t)return res.status(404).end();const base=process.env.PUBLIC_BASE_URL||`${req.protocol}://${req.get('host')}`;res.type('png').send(await QRCode.toBuffer(`${base.replace(/\/$/,'')}/validate/${t.ticketCode}`,{width:360,margin:2}))});
 app.get('/api/tickets/:code',async(req,res)=>{const t=await collections.tickets.findOne({ticketCode:req.params.code,status:'valid'});if(!t)return res.json({valid:false});res.json({valid:true,event:t.eventTitle,venue:t.venueName,startsAt:t.startsAt,seat:t.seatCode,section:t.section,gate:t.gate,tier:t.tierName})});
  app.get('/validate/:code',async(req,res)=>{const t=await collections.tickets.findOne({ticketCode:req.params.code,status:'valid'});const text=t?`VALID TICKET\n${t.eventTitle}\n${t.venueName}\n${t.seatCode||t.section}\n${t.gate||'See event gate instructions'}`:'INVALID OR USED TICKET';res.status(t?200:404).type('text/plain').send(text)});
 console.log(`Ticketing Kenya connected to MongoDB database ${mongoDbName}`);
}

async function accessOrder(id,token){if(!token)return null;return collections.orders.findOne({_id:String(id),accessHash:crypto.createHash('sha256').update(String(token)).digest('hex')})}
async function drawTicketPdf(doc,t,baseUrl){
 const palette=t.eventCategory==='Sports'?{dark:'#123b2a',accent:'#d5a94e',paper:'#f7f4e9',label:'STADIUM PASS'}:t.eventCategory==='Cinema'?{dark:'#29252a',accent:'#bd3e38',paper:'#f6f1ed',label:'CINEMA ADMIT ONE'}:t.eventCategory==='Arts & Theatre'?{dark:'#4a2332',accent:'#c59a55',paper:'#f7f0e8',label:'THEATRE ENTRY'}:{dark:'#143951',accent:'#b83b32',paper:'#fbfaf6',label:'EVENT PASS'};
 doc.rect(0,0,420,595).fill(palette.paper);doc.rect(0,0,420,162).fill(palette.dark);doc.rect(0,157,420,5).fill(palette.accent);doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(13).text('TICKETING KENYA',28,24);doc.fillColor(palette.accent).fontSize(9).text(palette.label,28,62);doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(23).text(t.eventTitle,{x:28,y:84,width:356,height:58});doc.fillColor('#273640').font('Helvetica-Bold').fontSize(8).text('ATTENDEE',28,188);doc.font('Helvetica').fontSize(14).text(t.attendee.name,28,203);doc.font('Helvetica-Bold').fontSize(8).text('VENUE',28,242);doc.font('Helvetica').fontSize(12).text(`${t.venueName}, ${t.venueTown}`,28,257,{width:355});doc.font('Helvetica-Bold').fontSize(8).text('DATE & TIME',28,291);doc.font('Helvetica').fontSize(11).text(new Date(t.startsAt).toLocaleString('en-KE',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Nairobi'}),28,305);doc.font('Helvetica-Bold').fontSize(8).text('TICKET TYPE',28,341);doc.font('Helvetica').fontSize(12).text(t.tierName,28,356);doc.font('Helvetica-Bold').fontSize(8).text(t.seatCode&&t.seatCode!=='General admission'?'SEAT':'ACCESS',28,391);doc.font('Helvetica-Bold').fontSize(19).fillColor(palette.dark).text(t.seatCode||t.section,28,406);doc.font('Helvetica-Bold').fontSize(8).fillColor('#273640').text('ENTRY GATE',245,391);doc.font('Helvetica').fontSize(12).text(t.gate||'See event gate instructions',245,408,{width:145});doc.font('Helvetica').fontSize(8).fillColor('#60717c').text(`TICKET ID  ${t.ticketCode}`,28,455);const qr=await QRCode.toBuffer(`${baseUrl.replace(/\/$/,'')}/validate/${t.ticketCode}`,{width:145,margin:1});doc.image(qr,245,452,{width:125,height:125});doc.moveTo(28,493).lineTo(220,493).dash(3,{space:3}).stroke('#aeb8bb');doc.font('Helvetica').fontSize(8).fillColor('#60717c').text('Scan at entry · valid for one admission · no resale',28,510,{width:190});doc.font('Helvetica-Bold').fontSize(8).fillColor(palette.dark).text('KARIBU. ENJOY THE MOMENT.',28,555)}

let collections;
async function connectDatabaseWithRetry(){
 while(client&&!databaseReady){
  try{await start();return}
  catch(err){databaseReady=false;console.error('MongoDB startup failed; web server remains available. Retrying in 30 seconds:',err);await new Promise(resolve=>setTimeout(resolve,30000))}
 }
}
if(client)connectDatabaseWithRetry();
