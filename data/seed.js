import { QdrantClient } from '@qdrant/js-client-rest';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../server/.env') });

const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL || 'http://localhost:6333'
});
const COLLECTION = process.env.QDRANT_COLLECTION || 'rec_conference';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

const documents = [
  {
    source: 'REC/Background/NREP-Overview', edition: 'all',
    text: 'The National Renewable Energy Platform (NREP) is established under the Ministry of Energy and Mineral Development (MEMD) of Uganda. NREP was created to spearhead interlinkages among academia, industry, government, and non-governmental organisations to address challenges in the renewable energy sector. The NREP office is located at Amber House, 2nd Floor Block A, Room A203, Plot 29/33, Kampala Road, Kampala, Uganda. Working hours are Monday to Friday 8:00-17:00. Contact: +256 (0) 393100495, info@nrep.ug, nrep.memd@gmail.com. Website: nrep.ug.'
  },
  {
    source: 'REC/Background/REC-History', edition: 'all',
    text: 'The Renewable Energy Conference and EXPO (REC) is Uganda\'s Annual Renewable Energy Conference organised by the Ministry of Energy and Mineral Development (MEMD) in partnership with the National Renewable Energy Platform (NREP). The REC series started in 2022. Editions: REC22 (2022) 1st edition, REC23 (2023) 2nd edition, REC24 (2024) 3rd edition, REC25 (2025) 4th edition, REC26 (2026) 5th edition. The conference brings together thousands of stakeholders from academia, industry, government, development partners, civil society organisations, and the general public to share experiences and foster renewable energy adoption in Uganda.'
  },
  {
    source: 'REC/Background/Uganda-Energy-Context', edition: 'all',
    text: 'Uganda renewable energy technical potential: hydropower 4,500 MW, geothermal 450 MW, biomass cogeneration 1,650 MW, wind 300 MW, solar energy 5.1 kWh/m2. By 2021, installed electricity generating capacity was 1,346.6 MW. Biomass dominates Uganda energy mix at 90% of total primary energy consumption. Electricity contributes only 1.4% to national energy consumption. As of 2025 approximately 57% of Ugandans have electricity access and rural electrification is below 20%. Uganda Vision 2040 aims for upper middle-income status with energy as a critical enabler.'
  },
  {
    source: 'REC/Background/Key-Partners', edition: 'all',
    text: 'Key partners across REC editions: Ministry of Energy and Mineral Development (MEMD) lead organiser, National Renewable Energy Platform (NREP) co-organiser, British High Commission Kampala, UK MECS, GIZ Uganda, UECCC, TotalEnergies, GGGI Uganda, FAO, SNV, Mercy Corps, ICLEI Africa, MUBS, FSD Africa, World Resources Institute, SOLCO, European Union, UNOPS, Stanbic Bank Uganda, Equity Bank Uganda, EACREEE, EEAU, Heifer International, BGFA, USEA, UNACC, UNREEEA, Serena Hotels, Ayuda en Accion, KABConsult.'
  },
  {
    source: 'REC22/Overview', edition: 'REC22 2022',
    text: 'REC22 — Renewable Energy Conference 2022 and EXPO, 1st Edition. Venue: Speke Resort Munyonyo, Kampala, Uganda. Theme: Renewable Energy for Sustainable Industrialization, Inclusive Growth and Economic Recovery. Expected physical attendance up to 2,000 people. Organised by MEMD through NREP. Featured conference sessions and exhibition with stalls for exhibitors to showcase products and services. Also included the Renewable Energy Innovation Challenge 2022 (REIC22) and a national run for SDGs dedicated to Affordable Energy.'
  },
  {
    source: 'REC22/Sessions', edition: 'REC22 2022',
    text: 'REC22 sessions addressed: strategies for promoting renewable energy adoption, financing renewable energy projects, technology transfer and innovation, off-grid energy solutions, clean cooking technologies, mini-grid development, solar energy deployment, biomass energy utilisation, regulatory frameworks for renewable energy, private sector engagement, and community-level renewable energy programmes. Exhibition ran in parallel allowing exhibitors to showcase renewable energy products, technologies, and services.'
  },
  {
    source: 'REC23/Overview', edition: 'REC23 2023',
    text: 'REC23 — Renewable Energy Conference and EXPO 2023, 2nd Annual Edition. Dates: 16-18 November 2023. Venue: Munyonyo Commonwealth Resort, Kampala, Uganda — same lakeside venue as REC22. Organised by MEMD and NREP. Brought together thousands of stakeholders from academia, industry, government, development partners, civil society, and the general public. Featured main conference, several side events, and exhibition of renewable energy innovations, businesses, and technologies.'
  },
  {
    source: 'REC23/Topics', edition: 'REC23 2023',
    text: 'REC23 topical discussions: Tax and finance issues in the energy industry, Innovation and technology for low-carbon energy systems, Delivering clean energy during global crisis — energy security and climate change, Carbon markets and quality global carbon market standards, Off-grid energy solutions and rural electrification, Clean cooking technologies, Mini-grid development and regulation, Solar energy market development, Energy efficiency policies, Productive use of renewable energy, Gender and inclusion in energy, Investment and financing for renewable energy in Uganda.'
    
  },
  {
    source: 'REC24/Overview', edition: 'REC24 2024',
    text: 'REC24 — Renewable Energy Conference and EXPO 2024, 3rd Annual Edition. Dates: 31 October to 2 November 2024. Venue: Speke Resort Munyonyo, Kampala, Uganda. Theme: Transforming Livelihoods Through Clean Energy Access. REC24 marked the conclusion of the 20th Energy and Minerals Week organised by MEMD. Organised by the Ministry of Energy and Mineral Development in collaboration with NREP.'
  },
  {
    source: 'REC24/Theme-Focus', edition: 'REC24 2024',
    text: 'REC24 theme Transforming Livelihoods Through Clean Energy Access focused on how renewable energy directly improves lives. Key discussions: clean energy access for rural and underserved communities, productive use of renewable energy to transform livelihoods, clean cooking as a livelihood and health intervention, off-grid solutions for economic empowerment, energy access financing and business models, last-mile electrification, women and youth in clean energy, and measuring impact of clean energy programmes on household welfare.'
  },
  {
    source: 'REC25/Overview', edition: 'REC25 2025',
    text: 'REC25 — Renewable Energy Conference and EXPO 2025, 4th Annual Edition. Dates: 20-22 October 2025. Venue: Kampala Serena Hotel, Uganda. Organised by MEMD in partnership with NREP. REC25 attracted representatives from over 20 nations — most international edition to date. Brought together experts, innovators, policymakers, and stakeholders to discuss and advance the clean energy agenda.'
  },
  {
    source: 'REC25/Topics', edition: 'REC25 2025',
    text: 'REC25 topical discussions: Access to Finance for the Off-grid Sector under the Electricity Access Scale-up Project (EASP), Clean cooking and behaviour change communication, Mini-grids and distributed energy systems, Solar energy market development, Productive use of renewable energy for agriculture and SMEs, Energy storage and grid technologies, Digitalization in energy, Carbon markets and climate finance, Regional energy cooperation, Gender equality and social inclusion, Youth and future generations in clean energy.'
  },
  {
    source: 'REC25/Outcomes', edition: 'REC25 2025',
    text: 'REC25 outcomes: Attracted representatives from over 20 nations. Commitments from REC25 formed the basis of REC26 agenda. Key outcomes included recommendations on scaling off-grid energy, advancing clean cooking, strengthening energy financing, and accelerating Uganda clean energy transition. REC26 was announced at REC25 with the theme From Systems to Scale: Powering Uganda Green Economy.'
  },
  {
    source: 'REC25/Government-Leadership', edition: 'REC25 2025',
    text: 'Government leadership at REC25: Minister of Energy and Mineral Development — Hon. Ruth Nankabirwa, chief government representative at multiple REC editions. British High Commissioner to Uganda — H.E. Elisa Chesney, participated in energy access events reaffirming UK commitment to Uganda clean energy transition. UK support through UK MECS programme and British High Commission partnerships with NREP.'
  },
  {
    source: 'REC26/Overview', edition: 'REC26 2026',
    text: 'REC26 — Renewable Energy Conference 2026 and EXPO, 5th Annual Edition. Dates: 19-22 October 2026. Venue: Kampala Serena Hotel, Uganda. Theme: From Systems to Scale: Powering Uganda Green Economy. Organised by MEMD in partnership with NREP. Registration opening soon at nrep.ug. Expected 2,000 plus participants. Sponsorship packages available at nrep.ug/rec/rec-expo-sponsorship-package-request.'
  },
  {
    source: 'REC26/Theme', edition: 'REC26 2026',
    text: 'REC26 theme: From Systems to Scale: Powering Uganda Green Economy. Reflects Uganda ambition to move beyond pilot programmes toward system-wide scale-up of renewable energy. Key thematic areas: scaling renewable energy systems and markets, green economy development and job creation, industrial growth powered by clean energy, energy storage and smart grid technologies, investment and financing at scale, regional cooperation, digital transformation of energy, and advancing Uganda clean energy transition commitments.'
  },
  {
    source: 'REC26/Sponsors', edition: 'REC26 2026',
    text: 'REC26 confirmed sponsors and partners: British High Commission Kampala, UK MECS, GIZ Uganda, UECCC, SNV Development Organisation, TotalEnergies, GGGI Uganda, FAO, Mercy Corps, ICLEI Africa, MUBS, FSD Africa, World Resources Institute WRI, SOLCO, Ayuda en Accion, Stanbic Bank Uganda, Equity Bank Uganda, EEAU, Heifer International, BGFA, EACREEE, European Union, UNOPS, Serena Hotels, CI SAND SUITES HOTELS, UNACC, USEA, KABConsult.'
  },
  {
    source: 'REC26/Why-Attend', edition: 'REC26 2026',
    text: 'Why attend REC26 October 19-22 2026 at Kampala Serena Hotel: Engage with 2000 plus participants including government officials, industry leaders, researchers, CSOs. Connect with stakeholders from over 20 nations. Build on commitments from REC25. Dialogue with international leaders on scaling renewable energy. Explore renewable energy for industrial growth and green jobs. Showcase technologies for large-scale deployment. Connect with financiers and investors. Network with policymakers, investors, entrepreneurs, and practitioners shaping Africa energy future.'
  },
  {
    source: 'REC/Features/Venues-History', edition: 'all',
    text: 'REC conference venues by edition: REC22 2022 — Speke Resort Munyonyo Kampala Uganda. REC23 2023 — Munyonyo Commonwealth Resort Kampala Uganda. REC24 2024 — Speke Resort Munyonyo Kampala Uganda. REC25 2025 — Kampala Serena Hotel Uganda. REC26 2026 — Kampala Serena Hotel Uganda confirmed. The move to Kampala Serena Hotel for REC25 and REC26 reflects the conference growing profile and international attendance.'
  },
  {
    source: 'REC/Features/Registration', edition: 'all',
    text: 'REC conference registration is handled through NREP website at nrep.ug/rec. Delegate categories: Government and public sector, Private sector and industry, Academic and research, Civil society organisations, Development partners, Exhibitors and sponsors, Media and press. Exhibition visitors can register free for the EXPO portion. For REC26 registration visit nrep.ug — opening soon. Sponsorship packages at nrep.ug/rec/rec-expo-sponsorship-package-request. Contact NREP at info@nrep.ug or +256 393100495.'
  }
];

async function embedText(text) {
  const res = await axios.post(`${OLLAMA_URL}/api/embeddings`, {
    model: 'nomic-embed-text', prompt: text
  });
  return res.data.embedding;
}

async function seed() {
  console.log('\n RECBrain — REC Uganda Knowledge Base Seeder');
  console.log('   Covers: REC22 (2022) through REC26 (2026)');
  console.log(`   Documents: ${documents.length}\n`);

  try {
    await qdrant.createCollection(COLLECTION, {
      vectors: { size: 768, distance: 'Cosine' }
    });
    console.log('✓ Qdrant collection created');
  } catch (_) { console.log('→ Collection exists, upserting...'); }

  const points = [];
  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];
    process.stdout.write(
      `  [${i+1}/${documents.length}] ${doc.edition}: ${doc.source.split('/').pop()}...`
    );
    try {
      const vector = await embedText(doc.text);
      points.push({
        id: i + 1, vector,
        payload: {
          text: doc.text,
          source: doc.source,
          edition: doc.edition
        }
      });
      process.stdout.write(' ✓\n');
    } catch (err) {
      process.stdout.write(` ✗ ${err.message}\n`);
    }
  }

  await qdrant.upsert(COLLECTION, { wait: true, points });
  console.log(`\n✓ Seeded ${points.length} documents into Qdrant`);
  console.log('✓ RECBrain is ready!\n');
  console.log('Test questions:');
  console.log('  - When did REC start?');
  console.log('  - What was the theme of REC24?');
  console.log('  - Where was REC25 held?');
  console.log('  - When is REC26 and what is the theme?');
  console.log('  - Who organises the REC conference?\n');
}

seed().catch(console.error);