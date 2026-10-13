import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { publicAPI, qualcommAPI } from '../api/client';
import RealIndiaMap from '../components/map/RealIndiaMap';
import './PublicLanding.css';

/* ── SVG Icon Components (replacing emojis) ── */

const SatelliteIcon = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 7L9 3L5 7l4 4" /><path d="M17 11l4 4-4 4-4-4" />
    <path d="m8 12 4 4" /><path d="m12 8 4 4" />
    <path d="M2 22c3-3 4.5-6 4.5-9s-1.5-6-4.5-9" /><path d="M7 17c1.5-1.5 2.5-3.5 2.5-5.5S8.5 8 7 6.5" />
  </svg>
);

const RadarIcon = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19.07 4.93A10 10 0 0 0 6.99 3.34" /><path d="M4 6h.01" />
    <path d="M2.29 9.62A10 10 0 1 0 21.31 8.35" /><path d="M16.24 7.76A6 6 0 1 0 8.23 16.67" />
    <path d="M12 18h.01" /><circle cx="12" cy="12" r="2" />
    <path d="m13.41 10.59 5.66-5.66" />
  </svg>
);

const ShieldIcon = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const WavesIcon = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
    <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
    <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
  </svg>
);

const AlertTriangleIcon = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const CoralIcon = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="1.8" strokeLinecap="round">
    <path d="M12 22V12" /><path d="M12 12c-2-3-6-4-6-8a6 6 0 0 1 12 0c0 4-4 5-6 8z" />
    <path d="M7 14c-1-1-3-1.5-3-4" /><path d="M17 14c1-1 3-1.5 3-4" />
  </svg>
);

const TurtleIcon = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round">
    <ellipse cx="12" cy="13" rx="7" ry="5" /><path d="M12 8V5" /><circle cx="12" cy="4" r="1.5" />
    <path d="M5 13l-2 3" /><path d="M19 13l2 3" /><path d="M7 17l-1 3" /><path d="M17 17l1 3" />
    <path d="M9 11v4" /><path d="M15 11v4" /><path d="M12 10v6" />
  </svg>
);

const MangroveIcon = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="1.8" strokeLinecap="round">
    <path d="M12 22v-8" /><path d="M12 14c-3-2-5-5-3-9 0 0 3 2 3 5" /><path d="M12 14c3-2 5-5 3-9 0 0-3 2-3 5" />
    <path d="M8 22c0-2 1-3 2-4" /><path d="M16 22c0-2-1-3-2-4" />
  </svg>
);

const FishIcon = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round">
    <path d="M6.5 12c5-6 12-2.5 14.5 0-2.5 2.5-9.5 6-14.5 0z" />
    <path d="M2.5 12S4 8 6.5 12 4 16 2.5 12" /><circle cx="15" cy="12" r="1" fill="#3b82f6" />
  </svg>
);

const PhoneIcon = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

const BirdIcon = ({ size = 24, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 7h.01" /><path d="M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20" />
    <path d="m20 7 2 .5-2 .5" /><path d="M10 18v3" /><path d="M14 17.75V21" /><path d="M7 18a6 6 0 0 0 3.84-10.61" />
  </svg>
);

const EyeIcon = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
  </svg>
);

const MapPinIcon = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
  </svg>
);

const CheckCircleIcon = ({ size = 20, color = '#2980b9' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const DolphinIcon = ({ size = 24, color = '#0284c7' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 13c3-5 9-7 14-4 2 1.2 3.5 3 4 5-1.5-.5-3.5-.5-5 0-2-3-6-4-9-2l-4 1z" />
    <path d="M12 9c.5-2 2-3.5 3.5-4" />
    <path d="M4 14l-2 3 3-1" />
  </svg>
);

const JellyfishIcon = ({ size = 24, color = '#7c3aed' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 11a6 6 0 0 1 12 0c0 1.5-.5 2-6 2s-6-.5-6-2z" />
    <path d="M8 13v6c0 1-.5 2-1 2" />
    <path d="M11 13v7c0 .5.5 1 1 1s1-.5 1-1v-7" />
    <path d="M16 13v6c0 1 .5 2 1 2" />
  </svg>
);

const OctopusIcon = ({ size = 24, color = '#ea580c' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="9" r="5" />
    <path d="M8 13c-2 2-2 5 0 6 1 .5 2 0 2-2v-4" />
    <path d="M11 14v4c0 1.5 1 2 2 1s1-2 0-3" />
    <path d="M16 13c2 2 2 5 0 6-1 .5-2 0-2-2v-4" />
    <circle cx="10" cy="8.5" r="0.75" fill={color} />
    <circle cx="14" cy="8.5" r="0.75" fill={color} />
  </svg>
);

const StarfishIcon = ({ size = 24, color = '#059669' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const IndiaFlagIcon = () => (
  <svg width="18" height="12" viewBox="0 0 900 600" style={{ borderRadius: 2, display: 'inline-block', verticalAlign: 'middle', boxShadow: '0 1px 2px rgba(0,0,0,0.25)' }}>
    <rect width="900" height="200" fill="#FF9933" />
    <rect y="200" width="900" height="200" fill="#FFFFFF" />
    <rect y="400" width="900" height="200" fill="#138808" />
    <circle cx="450" cy="300" r="70" fill="none" stroke="#000080" strokeWidth="18" />
  </svg>
);


/* ── Eco tab icon map ── */
const ecoTabIcons = {
  coral: { icon: <CoralIcon />, bg: 'rgba(249, 115, 22, 0.1)' },
  turtles: { icon: <TurtleIcon />, bg: 'rgba(16, 185, 129, 0.1)' },
  mangroves: { icon: <MangroveIcon />, bg: 'rgba(34, 197, 94, 0.1)' },
  fisherfolk: { icon: <FishIcon />, bg: 'rgba(59, 130, 246, 0.1)' },
};

const ecoTabLabels = {
  coral: 'Coral Reef Sanctuaries',
  turtles: 'Sea Turtles & Marine Fauna',
  mangroves: 'Mangroves & Blue Carbon',
  fisherfolk: 'Fisherfolk Communities',
};


export default function PublicLanding() {
  const [stats, setStats] = useState(null);
  const [period, setPeriod] = useState('all');
  const [loadingStats, setLoadingStats] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [activeTab, setActiveTab] = useState('coral');
  const [activeSatelliteTarget, setActiveSatelliteTarget] = useState(0);
  const [sarViewMode, setSarViewMode] = useState('overlay');
  const [pledgeSigned, setPledgeSigned] = useState(false);
  const [pledgeCount, setPledgeCount] = useState(12480);
  const [openFaq, setOpenFaq] = useState(null);
  const [checkedPledges, setCheckedPledges] = useState({
    report: true,
    plastic: true,
    wildlife: true
  });

  // Multilingual Public Safety Advisory (Qualcomm Cloud AI Llama-3.3-70B)
  const [advisoryLang, setAdvisoryLang] = useState('en');
  const [advisoryData, setAdvisoryData] = useState(null);
  const [loadingAdvisory, setLoadingAdvisory] = useState(false);
  const [speakingAdvisory, setSpeakingAdvisory] = useState(false);
  const [copiedAdvisory, setCopiedAdvisory] = useState(false);

  // Marine biodiversity sanctuary interactive explorer state
  const [speciesFilter, setSpeciesFilter] = useState('all');
  const [activeSpeciesId, setActiveSpeciesId] = useState('dolphin');
  const [speciesViewMode, setSpeciesViewMode] = useState('console'); // 'console' | 'table'

  const marineSpeciesList = [
    {
      id: 'dolphin',
      num: 1,
      indexNum: '01',
      code: 'BIO-01',
      category: 'mammal',
      commonName: 'Indo-Pacific Bottlenose Dolphin',
      scientificName: 'Tursiops aduncus',
      taxonomicClass: 'Mammalia • Cetacea',
      trophicRole: 'Apex Pelagic Predator',
      sensitivity: 'Critical Exposure Tier-1',
      status: 'Schedule I Protected',
      statusColor: '#334155',
      statusBg: '#f1f5f9',
      habitat: 'Gulf of Mannar & Malabar Coast',
      threatVector: 'Inhalation of Volatile Aromatic BTEX Vapors',
      threatTags: ['Blowhole Mucosal Burns', 'Acute Pulmonary Edema', 'Acoustic Disorientation'],
      threat: 'Surface respiration pulls toxic volatile aromatic hydrocarbons (BTEX vapors) into blowhole lungs; causes acute pulmonary edema, chemical burns, and acoustic disorientation.',
      safeguardRule: 'NOS-DCP Cetacean Bio-Exclusion Annex 4',
      safeguardTags: ['Acoustic Bubble Curtains', 'Bio-Acoustic Hazing', 'Zero-Dispersant Radius'],
      safeguard: 'Deployment of specialized acoustic bubble curtains and marine acoustic hazing protocols to deter cetacean pods from active slick containment sectors.'
    },
    {
      id: 'turtle',
      num: 2,
      indexNum: '02',
      code: 'BIO-02',
      category: 'mammal',
      commonName: 'Olive Ridley & Hawksbill Sea Turtle',
      scientificName: 'Lepidochelys olivacea',
      taxonomicClass: 'Reptilia • Testudines',
      trophicRole: 'Pelagic & Benthic Feeder',
      sensitivity: 'Severe Ingestion & Rookery Hazard',
      status: 'Vulnerable (IUCN)',
      statusColor: '#334155',
      statusBg: '#f1f5f9',
      habitat: 'Rushikulya & Gahirmatha Arribada Rookeries',
      threatVector: 'Tarball Ingestion & Nesting Beach Oil Smothering',
      threatTags: ['Asphaltic Tarball Ingestion', 'Nesting Sand Toxicity', 'Hatchling Surf Trap'],
      threat: 'Ingests floating asphaltic tarballs mistaking them for jellyfish prey; hatchlings crawl through heavy coastal oil slicks along nesting beaches.',
      safeguardRule: 'NOS-DCP Arribada Protection Mandate 7.2',
      safeguardTags: ['12 nm Chemical Exclusion', 'Shoreline Deflection Booms', 'Night Arribada Patrols'],
      safeguard: 'Zero chemical dispersant spraying within 12 nm of arribada rookeries; priority deflection containment booms along shoreline arrival corridors.'
    },
    {
      id: 'coral',
      num: 3,
      indexNum: '03',
      code: 'BIO-03',
      category: 'reef',
      commonName: 'Branching Staghorn & Brain Coral',
      scientificName: 'Acropora formosa & Diploria',
      taxonomicClass: 'Anthozoa • Scleractinia',
      trophicRole: 'Primary Biogenic Reef Architect',
      sensitivity: 'Irreversible Bleaching & Colony Smothering',
      status: 'Critically Vulnerable',
      statusColor: '#334155',
      statusBg: '#f1f5f9',
      habitat: 'Palk Bay, Gulf of Kutch & Lakshadweep Atolls',
      threatVector: 'Polyp Smothering & Photosynthetic Light Blockade',
      threatTags: ['Zooxanthellae Bleaching', 'Surface Light Blockade', 'Tissue Necrosis'],
      threat: 'Sinking weathered crude covers living polyps, cutting off photosynthetic light to symbiotic zooxanthellae algae and triggering irreversible colony bleaching.',
      safeguardRule: 'NOS-DCP Zero-Dispersant Sensitivity Zone',
      safeguardTags: ['5m Seaward Deflection Barriers', 'Zero Chemical Dispersants', 'Autonomous Fluorometry'],
      safeguard: 'Priority deflection barriers anchored seaward of the 5-meter depth contour to prevent emulsified mousse from contacting shallow reef crests.'
    },
    {
      id: 'jellyfish',
      num: 4,
      indexNum: '04',
      code: 'BIO-04',
      category: 'reef',
      commonName: 'Bioluminescent Moon Jellyfish',
      scientificName: 'Pelagia noctiluca',
      taxonomicClass: 'Scyphozoa • Semaeostomeae',
      trophicRole: 'Pelagic Trophic Vector',
      sensitivity: 'Trophic Bioaccumulation Vector',
      status: 'Pelagic Trophic Indicator',
      statusColor: '#334155',
      statusBg: '#f1f5f9',
      habitat: 'Andaman Basin & Pelagic Currents',
      threatVector: 'Micro-Droplet Absorption & Food-Web Biomagnification',
      threatTags: ['PAH Tissue Absorption', 'Planktonic Mortality', 'Bio-Magnification'],
      threat: 'Absorbs microscopic dispersed oil droplets into gelatinous bell tissue, bioaccumulating polycyclic aromatic hydrocarbons across the pelagic marine food web.',
      safeguardRule: 'INCOIS Autonomous Sub-Surface Surveillance',
      safeguardTags: ['Autonomous Slocum Gliders', 'Fluorometric Plume Profiling', 'Dispersant Restriction'],
      safeguard: 'Real-time water column fluorometric monitoring by autonomous INCOIS gliders to track sub-surface dissolved hydrocarbon plumes.'
    },
    {
      id: 'octopus',
      num: 5,
      indexNum: '05',
      code: 'BIO-05',
      category: 'benthic',
      commonName: 'Day Octopus & Reef Cephalopods',
      scientificName: 'Octopus cyanea',
      taxonomicClass: 'Cephalopoda • Octopoda',
      trophicRole: 'Intelligent Benthic Predator',
      sensitivity: 'Chemosensory & Camouflage Disruption',
      status: 'Protected Benthic Mollusc',
      statusColor: '#334155',
      statusBg: '#f1f5f9',
      habitat: 'Shallow Coral Cavities & Rocky Inshore',
      threatVector: 'Suction Pad Chemosensory Receptor Toxicity',
      threatTags: ['Chemosensory Blinding', 'Chromatophore Paralysis', 'Sedimentation Shock'],
      threat: 'Chemosensory receptor cells on suction tentacle pads are chemically blinded by petroleum residues, impairing predation and skin camouflage chromatophores.',
      safeguardRule: 'NOS-DCP Benthic Sediment Quality Standard',
      safeguardTags: ['Benthic Core Sampling', 'Dissolved Oxygen Profiling', 'Zero Heavy Sinking Agents'],
      safeguard: 'Continuous benthic dissolved oxygen profiling and sediment core sampling to ensure zero heavy hydrocarbon sedimentation on the sea floor.'
    },
    {
      id: 'starfish',
      num: 6,
      indexNum: '06',
      code: 'BIO-06',
      category: 'benthic',
      commonName: 'Blue Sea Star & Coastal Hermit Crab',
      scientificName: 'Linckia laevigata & Coenobita',
      taxonomicClass: 'Asteroidea • Valvatida',
      trophicRole: 'Keystone Intertidal Grazer',
      sensitivity: 'Intertidal Substrate Smothering',
      status: 'Benthic Keystone Grazer',
      statusColor: '#334155',
      statusBg: '#f1f5f9',
      habitat: 'Intertidal Sand Flats & Pebble Basins',
      threatVector: 'Dense Tar-Mat Formation on Intertidal Flats',
      threatTags: ['Tube-Feet Suffocation', 'Micro-Algae Eradication', 'Tar-Mat Binding'],
      threat: 'Heavy asphaltic fractions bind with seafloor sediments and pebble flats, forming dense tar-mats that suffocate tube feet and eradicate micro-algae.',
      safeguardRule: 'NOS-DCP Shoreline Cleanup Protocol SOP-3',
      safeguardTags: ['Low-Pressure Ambient Flush', 'Manual Sorbent Recovery', 'Substrate Preservation'],
      safeguard: 'Low-pressure ambient temperature seawater flushing combined with manual collection along intertidal zones to preserve delicate bottom substrates.'
    }
  ];

  // Maritime GIS surveillance layer visibility state
  const [mapLayers, setMapLayers] = useState({
    slicks: true,
    ports: true,
    sanctuaries: true
  });

  useEffect(() => {
    const fetchStats = async () => {
      setLoadingStats(true);
      try {
        const res = await publicAPI.getStats(period);
        if (res?.data) {
          setStats(res.data);
        }
      } catch (err) {
        console.warn('Fallback to baseline conservation data:', err);
      } finally {
        setLoadingStats(false);
      }
    };
    fetchStats();
  }, [period]);

  useEffect(() => {
    let isMounted = true;
    const fetchAdvisory = async () => {
      setLoadingAdvisory(true);
      try {
        const res = await qualcommAPI.getPublicAdvisories(advisoryLang);
        if (isMounted && res?.data) {
          setAdvisoryData(res.data);
        }
      } catch (err) {
        console.warn('Qualcomm advisory fallback:', err);
      } finally {
        if (isMounted) setLoadingAdvisory(false);
      }
    };
    fetchAdvisory();
    return () => { isMounted = false; };
  }, [advisoryLang]);

  const handleToggleSpeak = () => {
    if (!window.speechSynthesis) return;
    if (speakingAdvisory) {
      window.speechSynthesis.cancel();
      setSpeakingAdvisory(false);
      return;
    }
    const textToSpeak = advisoryData?.advisory || '';
    if (!textToSpeak) return;
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    const langMap = { en: 'en-US', hi: 'hi-IN', te: 'te-IN', ta: 'ta-IN', ml: 'ml-IN' };
    utterance.lang = langMap[advisoryLang] || 'en-US';
    utterance.rate = 0.92;
    utterance.onend = () => setSpeakingAdvisory(false);
    utterance.onerror = () => setSpeakingAdvisory(false);
    window.speechSynthesis.speak(utterance);
    setSpeakingAdvisory(true);
  };

  const handleCopyAdvisory = () => {
    if (!advisoryData?.advisory) return;
    navigator.clipboard.writeText(advisoryData.advisory);
    setCopiedAdvisory(true);
    setTimeout(() => setCopiedAdvisory(false), 2200);
  };

  const handlePledgeSubmit = (e) => {
    e.preventDefault();
    if (!pledgeSigned) {
      setPledgeSigned(true);
      setPledgeCount(prev => prev + 1);
    }
  };

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  /* ── Content Data ── */

  const ecosystems = {
    coral: {
      title: "Fragile Coral Reef Sanctuaries",
      badge: "Highest Ecological Vulnerability",
      image: "/images/coral_reef.jpg",
      imageCaption: "Gulf of Mannar Marine Biosphere • Living Coral Reef Flats (Acropora & Porites)",
      summary: "India is blessed with 4 major coral reef formations: Gulf of Mannar, Gulf of Kutch, Andaman & Nicobar, and Lakshadweep Atolls.",
      description: "Coral polyps live in a delicate symbiotic relationship with zooxanthellae algae, which provide up to 90% of the coral's energy through photosynthesis. When oil slicks drift over shallow reef flats, they block sunlight, inhibit calcification, and cause acute thermal stress. Sinking hydrocarbon residues suffocate delicate branch corals (Acropora) and massive boulder corals (Porites), leading to rapid coral bleaching and multi-decade ecosystem collapse.",
      keyThreats: [
        "Photosynthesis shutdown due to surface light attenuation",
        "Direct chemical toxicity from water-soluble aromatic compounds",
        "Physical smothering of coral polyps by sinking weathered asphalt",
        "Loss of protective natural wave attenuation along coastal villages"
      ],
      protectionAction: "Indian maritime contingency plans designate coral zones as Zero-Dispersant Sensitivity Areas to protect delicate polyps from chemical toxicity."
    },
    turtles: {
      title: "Marine Wildlife & Sea Turtle Corridors",
      badge: "Protected Schedule-I Species",
      image: "/images/olive_ridley_turtles.jpg",
      imageCaption: "Gahirmatha Marine Sanctuary, Odisha • Olive Ridley Mass Nesting & Hatchlings",
      summary: "The Indian peninsula serves as a vital international highway for Olive Ridley turtles, Indo-Pacific humpback dolphins, blue whales, and elusive dugongs.",
      description: "Every winter, hundreds of thousands of Olive Ridley sea turtles navigate thousands of miles to mass-nest along the beaches of Odisha (Gahirmatha and Rushikulya). Because sea turtles must surface to breathe atmospheric air, they cannot avoid surface oil slicks. Ingesting oil or breathing volatile hydrocarbons damages their lungs, causes organ failure, and coats their sensitive nesting sands, disrupting temperature-dependent egg sex ratios.",
      keyThreats: [
        "Inhalation of toxic petroleum vapors at the water-air interface",
        "Internal organ poisoning through ingestion of contaminated jellyfish",
        "Hydrocarbon contamination of sandy beaches where egg clutches incubate",
        "Disorientation of hatchlings navigating toward bioluminescent surf"
      ],
      protectionAction: "Strict seasonal vessel speed limits and coastal surveillance corridors protect mass arribada nesting migrations every winter and spring."
    },
    mangroves: {
      title: "Mangrove Forests & Blue Carbon Sinks",
      badge: "Natural Storm Surge Shields",
      image: "/images/sundarbans_mangroves.jpg",
      imageCaption: "Sundarbans Biosphere Reserve Delta, West Bengal • Halophytic Mangrove Channels",
      summary: "Spanning the Sundarbans, Bhitarkanika, and Gulf of Khambhat, mangrove estuaries protect millions of coastal residents from cyclones.",
      description: "Mangroves possess specialized aerial root systems called pneumatophores, which stick out of tidal mudflats to breathe during low tide. When an oil slick is swept into mangrove estuaries by coastal tides, the viscous black oil adheres to these aerial breathing pores, suffocating the trees within days. Because mangrove mud lacks oxygen, buried oil fails to decompose and can remain toxic for more than three decades, wiping out fiddler crabs, mudskippers, and juvenile fish nurseries.",
      keyThreats: [
        "Clogging of pneumatophore breathing pores causing rapid mangrove die-off",
        "Anaerobic persistence of hydrocarbons in tidal mud for 30+ years",
        "Erosion of shorelines and loss of natural hurricane buffers",
        "Destruction of juvenile fish and prawn breeding grounds"
      ],
      protectionAction: "Hydrodynamic drift trajectory models alert response teams to deploy containment booms at estuary inlets before slicks reach tidal roots."
    },
    fisherfolk: {
      title: "Coastal Fisherfolk & Artisanal Livelihoods",
      badge: "Socio-Economic Well-being",
      image: "/images/coastal_fisherfolk.jpg",
      imageCaption: "Artisanal Fisherfolk Landing • Traditional Wooden Catamarans & Shore Seines",
      summary: "Over 4.2 million traditional fisherfolk across 3,200 coastal villages depend directly on unpolluted coastal waters for their daily bread.",
      description: "A marine spill instantly devastates artisanal fishing families. Beyond immediate fishing bans, petroleum hydrocarbons coat expensive nylon fishing nets, foul wooden and FRP boat hulls, and impart a pungent chemical taste to commercial fish species. Even after water surfaces appear clear, public anxiety regarding seafood safety can depress coastal fish markets for months, plunging vulnerable coastal families into financial hardship.",
      keyThreats: [
        "Immediate emergency closures of coastal fishing zones and harbors",
        "Irreparable oil contamination of artisanal nets, ropes, and boat hulls",
        "Bioaccumulation of polycyclic aromatic hydrocarbons (PAHs) in shellfish",
        "Severe economic depression in local coastal fish markets"
      ],
      protectionAction: "Rapid public transparency and water quality monitoring help certify safe fishing zones and facilitate rehabilitation support."
    }
  };

  const sanctuaries = [
    {
      name: "Gulf of Mannar Marine Biosphere",
      state: "Tamil Nadu",
      highlight: "3,600+ Marine Species",
      desc: "A globally recognized biological treasure covering 21 coastal islands. Home to 117 hard coral species, extensive seagrass meadows, and the vulnerable Dugong (sea cow).",
      priority: "CRITICAL SANCTUARY"
    },
    {
      name: "Gahirmatha Marine Sanctuary",
      state: "Odisha",
      highlight: "Largest Turtle Rookery",
      desc: "The world's largest mass nesting ground (arribada) for endangered Olive Ridley sea turtles. Extending 20 km into the sea, it hosts over 500,000 nesting females each winter.",
      priority: "HIGHLY SENSITIVE"
    },
    {
      name: "Sundarbans Biosphere Reserve",
      state: "West Bengal",
      highlight: "UNESCO World Heritage",
      desc: "The world's largest contiguous halophytic mangrove delta. Provides a protective nursery for coastal fisheries and acts as India's premier blue carbon fortress against cyclones.",
      priority: "CRITICAL SANCTUARY"
    },
    {
      name: "Malvan Marine Sanctuary",
      state: "Maharashtra",
      highlight: "Konkan Coral Formations",
      desc: "Established along the Sindhudurg coastline to protect rich intertidal rocky shores, coral formations, pearl oysters, and playful pods of Indo-Pacific humpback dolphins.",
      priority: "PROTECTED ZONE"
    }
  ];

  const faqs = [
    {
      q: "What causes marine oil pollution along the Indian coastline?",
      a: "India sits adjacent to one of the world's busiest maritime oil transit routes connecting the Middle East to East Asia through the Arabian Sea, Malacca Straits, and Bay of Bengal. Sources include accidental collisions, grounding on shallow reefs, illegal night-time bilge washing by passing merchant vessels, and pipeline leaks near offshore terminals."
    },
    {
      q: "Why can't chemical dispersants be sprayed on every oil slick?",
      a: "While dispersants break surface oil into tiny droplets so it sinks, this forces toxic hydrocarbons down into the water column where fish larvae, plankton, and coral polyps live. Under the National Oil Spill Disaster Contingency Plan (NOS-DCP), dispersant use is strictly prohibited in shallow waters under 20 meters and near sensitive marine sanctuaries."
    },
    {
      q: "How does ocean current drift affect marine pollution?",
      a: "Oil slicks move under the combined influence of surface wind (typically 3% of wind speed) and ocean tidal currents. Using satellite SAR radar and high-resolution hydrodynamic drift modeling, scientists forecast where a slick will travel 24 to 72 hours in advance, giving authorities time to shield vulnerable river mouths and coral bays."
    },
    {
      q: "What should I do if I find oiled wildlife on a beach?",
      a: "Never attempt to wash oiled turtles, dolphins, or seabirds yourself with domestic dish soaps or detergents. Improper handling causes extreme distress, hypothermia, and chemical burns. Immediately contact the Indian Coast Guard maritime emergency helpline (1554) or your local Forest and Wildlife Department."
    },
    {
      q: "How can citizens and fishing communities report suspected spills?",
      a: "If you notice an iridescent petroleum sheen, pungent tar odors, dark patches on the water, or tarballs washed ashore, note your landmark or GPS location, take photos from a safe distance without touching the substance, and call toll-free emergency hotline 1554."
    }
  ];

  const spillMarkers = [
    {
      id: 1, name: 'Mumbai High Offshore Sector',
      lat: 18.850, lon: 71.900, area: 12.5, severity: 'high', priority: 'high',
      labelDir: 'west',
      coral: false, mpaDist: '142.5 km', coastDist: '142.5 km',
      desc: 'High-density industrial crude spill along primary shipping route. Advection monitored by Sentinel-1 SAR.'
    },
    {
      id: 2, name: 'Gulf of Kutch Deepwater Channel',
      lat: 22.500, lon: 68.950, area: 28.4, severity: 'critical', priority: 'critical',
      labelDir: 'west',
      coral: true, mpaDist: '3.1 km', coastDist: '3.1 km',
      desc: 'IMMEDIATE CORAL THREAT: 3.1 km from Marine National Park reef flats. Zero-dispersant sensitivity zone.'
    },
    {
      id: 3, name: 'Palk Strait Coral Biosphere',
      lat: 9.850, lon: 79.550, area: 6.8, severity: 'critical', priority: 'critical',
      labelDir: 'east',
      coral: true, mpaDist: '4.8 km', coastDist: '4.8 km',
      desc: 'CORAL REEF ENCLAVE: Dugong feeding seagrass and living Acropora coral atolls.'
    },
    {
      id: 4, name: 'Bay of Bengal Deepwater Basin',
      lat: 15.800, lon: 82.500, area: 32.8, severity: 'medium', priority: 'medium',
      labelDir: 'west',
      coral: false, mpaDist: '210.0 km', coastDist: '210.0 km',
      desc: 'Deepwater offshore slick drifting south-southwest under ERA5 atmospheric wind advection.'
    }
  ];

  const satelliteTargets = [
    {
      id: 'IND-SAR-002',
      name: 'Gulf of Kutch Deepwater Channel',
      shortName: 'Gulf of Kutch',
      coords: '22.450°N, 69.150°E',
      area: '28.4 km²',
      severity: 'CRITICAL',
      drift: '0.28 m/s @ 215° SW',
      confidence: '99.4%',
      threat: 'Coral Reef Sanctuary (3.1 km)',
      sensor: 'Sentinel-1A IW GRD (VV+VH)',
      oilType: 'Heavy Crude Emulsion',
      passTime: '14:22 UTC (Active Pass)',
      swathWidth: '250 km',
      polarization: 'VV + VH Dual-Pol'
    },
    {
      id: 'IND-SAR-001',
      name: 'Mumbai High Offshore Sector',
      shortName: 'Mumbai High',
      coords: '18.850°N, 71.900°E',
      area: '12.5 km²',
      severity: 'HIGH',
      drift: '0.34 m/s @ 190° S',
      confidence: '98.1%',
      threat: 'Shipping Route (142 km buffer)',
      sensor: 'Sentinel-1B IW GRD (VV)',
      oilType: 'Weathered Medium Crude',
      passTime: '11:05 UTC (3.5 hrs ago)',
      swathWidth: '250 km',
      polarization: 'VV Co-Pol'
    },
    {
      id: 'IND-SAR-003',
      name: 'Palk Strait Coral Biosphere',
      shortName: 'Palk Strait',
      coords: '9.450°N, 79.250°E',
      area: '6.8 km²',
      severity: 'CRITICAL',
      drift: '0.19 m/s @ 075° ENE',
      confidence: '97.6%',
      threat: 'Dugong Seagrass Reserve (4.8 km)',
      sensor: 'Sentinel-1A EW (VV+VH)',
      oilType: 'Bunker C Fuel Oil Slick',
      passTime: '08:40 UTC (6 hrs ago)',
      swathWidth: '400 km',
      polarization: 'VV + VH Dual-Pol'
    }
  ];

  /* ── Generate random particles for hero ── */
  const particles = Array.from({ length: 30 }, (_, i) => ({
    left: `${Math.random() * 100}%`,
    bottom: `${Math.random() * 30}%`,
    delay: `${Math.random() * 6}s`,
    duration: `${4 + Math.random() * 4}s`,
    size: `${2 + Math.random() * 2}px`,
  }));

  const currentSatTarget = satelliteTargets[activeSatelliteTarget] || satelliteTargets[0];

  return (
    <div className="landing-dark">
      {/* ────────── Official Government & Agency Authority Bar ────────── */}
      <div className="gov-top-bar">
        <div className="gov-top-bar-inner">
          <div className="gov-brand-left">
            <IndiaFlagIcon size={16} />
            <span className="gov-dept">GOVERNMENT OF INDIA</span>
            <span className="gov-sep">/</span>
            <span className="gov-agency">MINISTRY OF EARTH SCIENCES & INCOIS</span>
            <span className="gov-sep">/</span>
            <span className="gov-framework">NATIONAL OIL SPILL CONTINGENCY PLAN (NOS-DCP)</span>
          </div>
          <div className="gov-status-right">
            <span className="gov-status-dot" />
            <span className="gov-status-text">SENTINEL-1A SAR PASS: 14:22 UTC (ACTIVE)</span>
            <span className="gov-sep">|</span>
            <span className="gov-tollfree">MRCC TOLL-FREE: <strong>1554</strong></span>
          </div>
        </div>
      </div>

      {/* ────────── Navigation ────────── */}
      <nav className="nav-bar">
        <div className="nav-brand">
          <div className="nav-brand-icon" style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            padding: 0,
            overflow: 'hidden',
            background: 'transparent',
            border: '2px solid rgba(2, 132, 199, 0.4)',
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
            flexShrink: 0
          }}>
            <img
              src="/sarvas_logo.png"
              alt="SARVAS Logo"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
          <div>
            <div className="nav-brand-title" style={{ fontSize: '1.35rem', fontWeight: 900, letterSpacing: '1.2px' }}>
              SARVAS
            </div>
            <div className="nav-brand-sub" style={{ fontSize: '0.74rem', letterSpacing: '1px', fontWeight: 800, color: '#0284c7' }}>
              From Slick to Suspect
            </div>
          </div>
        </div>

        <div className="nav-links">
          <a href="#surveillance-map">National Radar Map</a>
          <a href="#habitats">Marine Habitats</a>
          <a href="#sanctuary-diorama">Living Sanctuary</a>
          <a href="#impact">Spill Science</a>
          <a href="#sanctuaries">MPA Sanctuaries</a>
          <a href="#report">Reporting Protocol</a>
          <a href="#pledge">Take Pledge</a>
        </div>

        <div className="nav-actions">
          <div className="nav-emergency">
            <PhoneIcon size={14} color="#f87171" />
            <span>Emergency 24/7:</span>
            <strong style={{ color: '#1a2b3c', fontSize: '0.88rem' }}>1554</strong>
          </div>
          <Link to="/login" className="nav-login-btn">
            Command Center Login →
          </Link>
        </div>
      </nav>

      {/* ────────── Hero Section with Authentic Satellite Radar Telemetry ────────── */}
      <section className="hero-section">
        <div className="hero-video-container">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="hero-bg-video"
            poster="/sat_thumb.jpg"
          >
            <source src="/sat.mp4" type="video/mp4" />
          </video>
          <div className="hero-bg-overlay" />
        </div>

        <div className="hero-container">
          {/* Left Column: Hero Content */}
          <div className="hero-content">
            <div className="hero-badge">
              <span className="hero-badge-pulse" />
              <SatelliteIcon size={14} color="#7dd3fc" />
              <span>Copernicus Sentinel-1 C-SAR • Orbital Maritime Surveillance</span>
            </div>

            <h1 className="hero-title">
              Defending India's Coastline with{' '}
              <span className="accent">Satellite Radar Intelligence</span>
            </h1>

            <p className="hero-subtitle">
              Continuous synthetic aperture radar (SAR) surveillance paired with hydrodynamic drift trajectory modeling defending India's 11,098.81 km sovereign coastline, sensitive marine national parks, and artisanal fishing zones under the National Oil Spill Disaster Contingency Plan (NOS-DCP).
            </p>

            <div className="hero-metrics-strip">
              <div className="hero-metric-item">
                <span className="hero-metric-num">11,098.81 km</span>
                <span className="hero-metric-label">India's Coastline Covered</span>
              </div>
              <div className="hero-metric-divider" />
              <div className="hero-metric-item">
                <span className="hero-metric-num">{stats?.ai_accuracy ? `${stats.ai_accuracy}%` : '95.9%'}</span>
                <span className="hero-metric-label">SAR AI Validation Accuracy</span>
              </div>
              <div className="hero-metric-divider" />
              <div className="hero-metric-item">
                <span className="hero-metric-num">{stats?.active_spills ?? spillMarkers.length}</span>
                <span className="hero-metric-label">Active Slicks Monitored</span>
              </div>
            </div>

            <div className="hero-cta-group">
              <a href="#surveillance-map" className="hero-cta-primary">
                <RadarIcon size={18} color="#ffffff" />
                Inspect Live Radar Map
              </a>
              <a href="#report" className="hero-cta-secondary">
                <AlertTriangleIcon size={18} color="#7dd3fc" />
                Citizen Reporting Guide
              </a>
              <a href="#pledge" className="hero-cta-tertiary">
                Take Clean Seas Pledge
              </a>
            </div>
          </div>

          {/* Right Column: Authentic Sentinel-1 SAR Radar HUD Terminal */}
          <div className="hero-radar-terminal">
            {/* Terminal Top Window Bar */}
            <div className="radar-term-header">
              <div className="radar-term-title-group">
                <div className="radar-term-dots">
                  <span className="dot dot-red" />
                  <span className="dot dot-amber" />
                  <span className="dot dot-green" />
                </div>
                <span className="radar-term-title">SENTINEL-1A C-SAR // AUTHENTIC RADAR CAPTURE</span>
              </div>
              <div className="radar-view-mode-toggle">
                <button
                  type="button"
                  className={`mode-toggle-btn ${sarViewMode === 'overlay' ? 'active' : ''}`}
                  onClick={() => setSarViewMode('overlay')}
                >
                  AI Detection Overlay
                </button>
                <button
                  type="button"
                  className={`mode-toggle-btn ${sarViewMode === 'raw' ? 'active' : ''}`}
                  onClick={() => setSarViewMode('raw')}
                >
                  Raw SAR Backscatter
                </button>
              </div>
            </div>

            {/* Radar Viewport: Authentic Satellite SAR Radar Photograph */}
            <div className="radar-viewport">
              <div className="radar-image-wrapper">
                <img
                  src="/images/sar_radar_spill.jpg"
                  alt="Sentinel-1 SAR Real Satellite Radar Oil Spill Capture"
                  className="radar-actual-img"
                />

                {/* Tactical AI HUD Overlay (When enabled) */}
                {sarViewMode === 'overlay' && (
                  <div className="radar-tactical-hud">
                    {/* Bounding Box over the oil slick */}
                    <div className="hud-bounding-box">
                      <div className="hud-corner top-left" />
                      <div className="hud-corner top-right" />
                      <div className="hud-corner bottom-left" />
                      <div className="hud-corner bottom-right" />
                      <div className="hud-tag">
                        <span className="hud-tag-dot">●</span>
                        CONFIRMED SLICK // {currentSatTarget.area}
                      </div>
                      <div className="hud-target-reticle" />
                    </div>

                    {/* Telemetry Reticles */}
                    <div className="hud-crosshair-h" />
                    <div className="hud-crosshair-v" />

                    {/* Sensor Data Chip */}
                    <div className="hud-sensor-chip">
                      <div className="hud-chip-row">
                        <span>LAT/LON:</span> <strong>{currentSatTarget.coords}</strong>
                      </div>
                      <div className="hud-chip-row">
                        <span>BACKSCATTER (σ°):</span> <strong>-25.4 dB (Wave Damped)</strong>
                      </div>
                      <div className="hud-chip-row">
                        <span>AI CONFIDENCE:</span> <strong style={{ color: '#10b981' }}>{currentSatTarget.confidence}</strong>
                      </div>
                      <div className="hud-chip-row">
                        <span>THREAT:</span> <strong style={{ color: '#ef4444' }}>{currentSatTarget.threat}</strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Target Telemetry Bar */}
            <div className="radar-term-telemetry">
              <div className="telemetry-cell">
                <span className="telemetry-label">SECTOR PASS</span>
                <span className="telemetry-val highlight">{currentSatTarget.shortName}</span>
              </div>
              <div className="telemetry-cell">
                <span className="telemetry-label">EST. AREA</span>
                <span className="telemetry-val">{currentSatTarget.area}</span>
              </div>
              <div className="telemetry-cell">
                <span className="telemetry-label">DRIFT VECTOR</span>
                <span className="telemetry-val">{currentSatTarget.drift}</span>
              </div>
              <div className="telemetry-cell">
                <span className="telemetry-label">AI VERIFICATION</span>
                <span className="telemetry-val badge-green">{currentSatTarget.confidence}</span>
              </div>
            </div>

            {/* Interactive Target Switcher */}
            <div className="radar-target-switcher">
              <span className="switcher-label">INSPECT SECTOR PASS:</span>
              <div className="switcher-pills">
                {satelliteTargets.map((t, idx) => (
                  <button
                    key={t.id}
                    className={`switcher-pill ${activeSatelliteTarget === idx ? 'active' : ''}`}
                    onClick={() => setActiveSatelliteTarget(idx)}
                  >
                    {t.shortName}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ────────── Stats Strip ────────── */}
      <section className="stats-section">
        <div className="stat-card">
          <div className="stat-label">SAR Radar Detected</div>
          <div className="stat-value">
            {stats?.total_spills ?? 4}<span>Slicks</span>
          </div>
          <div className="stat-desc">
            Active monitored slicks via ResNet-18 U-Net Sentinel-1 SAR surveillance
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">CMEMS Forced</div>
          <div className="stat-value">
            {(stats?.total_affected_area_sq_km ?? stats?.total_area_sq_km) ? Number(stats.total_affected_area_sq_km ?? stats.total_area_sq_km).toFixed(1) : '80.5'}<span>km²</span>
          </div>
          <div className="stat-desc">
            Total spill surface area from Copernicus hydrodynamic ocean models
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Coral Atlas</div>
          <div className="stat-value">
            {(stats?.coral_reef_area_risk_sq_km ?? stats?.coral_reef_area_sq_km) ? Number(stats.coral_reef_area_risk_sq_km ?? stats.coral_reef_area_sq_km).toFixed(1) : '28.2'}<span>km²</span>
          </div>
          <div className="stat-desc">
            Coral reef area at risk via Allen Coral Atlas GIS polygon intersection
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">India's Coastline Covered</div>
          <div className="stat-value">
            11,098.81<span>km</span>
          </div>
          <div className="stat-desc">
            Sovereign coastline & island territories monitored under active orbital SAR surveillance
          </div>
        </div>
      </section>

      {/* ────────── Main Content ────────── */}
      <main className="main-content">

        {/* ── Horizon Filter ── */}
        <div className="horizon-bar">
          <div className="horizon-label">
            <RadarIcon size={18} color="#5BA4C9" />
            <span>Ecological Observation Horizon</span>
            {loadingStats && (
              <span style={{ fontSize: '0.73rem', color: '#1a6fa0', fontWeight: 600, marginLeft: 8 }}>
                Updating...
              </span>
            )}
          </div>
          <div className="horizon-buttons">
            {[
              { id: 'all', label: 'All Records' },
              { id: 'year', label: 'Past 365 Days' },
              { id: 'month', label: 'Past 30 Days' },
              { id: 'day', label: 'Last 24 Hours' }
            ].map(p => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`horizon-btn ${period === p.id ? 'active' : ''}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── National Surveillance Map ── */}
        <section className="map-container" id="surveillance-map">
          <div className="map-header">
            <div>
              <div className="section-tag" style={{ marginBottom: 10 }}>
                <SatelliteIcon size={14} color="#5BA4C9" />
                REAL GIS DATA + SENTINEL-1 SAR SURVEILLANCE
              </div>
              <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1a2b3c', margin: 0 }}>
                Indian Coastal Sanctuaries, Coral Sands & Maritime Intelligence
              </h2>
              <p style={{ color: '#5a7a8f', fontSize: '0.86rem', margin: '6px 0 0 0' }}>
                Authentic GIS polygons of national marine protected areas, coral reefs, sandy spit reserves, and active radar detections.
              </p>
            </div>
            <div className="map-telemetry">
              <span>Current: <strong>0.28 m/s SW (215°)</strong></span>
              <span style={{ color: '#d4e6f1' }}>|</span>
              <span>Wind: <strong>5.8 m/s (205°)</strong></span>
              <span style={{ color: '#d4e6f1' }}>|</span>
              <span>Datum: <strong>WGS84</strong></span>
            </div>
          </div>

          {/* Map Toolbar */}
          <div className="map-toolbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, color: '#1e3a4f', fontSize: '0.78rem' }}>Layers:</span>
              {[
                { key: 'slicks', label: 'Active Slicks' },
                { key: 'sanctuaries', label: 'Marine Protected Areas & Sands (Real GIS)' },
                { key: 'ports', label: 'Major Commercial Ports' },
              ].map(l => (
                <label key={l.key} className="map-layer-toggle">
                  <input
                    type="checkbox"
                    checked={mapLayers[l.key]}
                    onChange={(e) => setMapLayers(prev => ({ ...prev, [l.key]: e.target.checked }))}
                  />
                  {l.label}
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: '#22c55e', boxShadow: '0 0 6px #22c55e',
                display: 'inline-block', flexShrink: 0
              }} />
              <span style={{ fontSize: '0.74rem', color: '#0369a1', fontWeight: 700 }}>
                Live Geospatial Feed
              </span>
            </div>
          </div>

          {/* Map Canvas */}
          <div className="map-canvas" style={{ height: '620px', minHeight: '620px', flexShrink: 0, display: 'block' }}>
            <RealIndiaMap
              selectedIncident={selectedIncident}
              setSelectedIncident={setSelectedIncident}
              mapLayers={mapLayers}
              setMapLayers={setMapLayers}
              spillMarkers={spillMarkers}
            />

            {/* Incident Popup — compact card below map */}
            {/* Incident Popup — compact card with exact coordinates and environmental intelligence */}
            {selectedIncident && (
              <div style={{
                position: 'absolute', bottom: 14, left: 14, zIndex: 20,
                background: 'rgba(10, 25, 47, 0.96)', backdropFilter: 'blur(12px)',
                padding: '14px 18px', borderRadius: 12, maxWidth: 360,
                border: '1px solid rgba(56, 189, 248, 0.35)',
                boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                color: '#e2e8f0', fontSize: '0.8rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: selectedIncident.priority === 'critical' ? '#dc2626' : (selectedIncident.severity === 'Protected MPA' ? '#059669' : '#0284c7')
                    }} />
                    <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#fff' }}>
                      {selectedIncident.spill_name}
                    </span>
                  </div>
                  <button onClick={() => setSelectedIncident(null)} style={{
                    background: 'rgba(255,255,255,0.1)', border: 'none', fontSize: '1rem',
                    cursor: 'pointer', color: '#94a3b8', padding: '2px 8px', borderRadius: 6
                  }}>×</button>
                </div>

                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
                  background: 'rgba(255,255,255,0.04)', padding: '8px 10px', borderRadius: 8, marginBottom: 8
                }}>
                  <div>
                    <div style={{ color: '#94a3b8', fontSize: '0.68rem', textTransform: 'uppercase', fontWeight: 600 }}>Exact Lat/Lon</div>
                    <div style={{ fontWeight: 800, color: '#38bdf8', fontSize: '0.74rem' }}>
                      {typeof selectedIncident.centroid_lat === 'number'
                        ? `${selectedIncident.centroid_lat.toFixed(3)}°N, ${selectedIncident.centroid_lon.toFixed(3)}°E`
                        : `${selectedIncident.centroid_lat}, ${selectedIncident.centroid_lon}`}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#94a3b8', fontSize: '0.68rem', textTransform: 'uppercase', fontWeight: 600 }}>Area / Scope</div>
                    <div style={{ fontWeight: 800, color: '#fff', fontSize: '0.74rem' }}>
                      {selectedIncident.affected_area_sq_km ? `${selectedIncident.affected_area_sq_km}${typeof selectedIncident.affected_area_sq_km === 'number' ? ' km²' : ''}` : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#94a3b8', fontSize: '0.68rem', textTransform: 'uppercase', fontWeight: 600 }}>Proximity</div>
                    <div style={{ fontWeight: 800, color: '#cbd5e1', fontSize: '0.74rem' }}>
                      {selectedIncident.coast_proximity_km || selectedIncident.nearest_mpa_distance_km || 'Coast'}
                    </div>
                  </div>
                </div>

                <div style={{
                  fontSize: '0.72rem', padding: '6px 10px', borderRadius: 6, lineHeight: 1.4,
                  background: selectedIncident.overlaps_coral ? 'rgba(220,38,38,0.15)' : 'rgba(14,165,233,0.12)',
                  color: selectedIncident.overlaps_coral ? '#fca5a5' : '#bae6fd',
                  border: `1px solid ${selectedIncident.overlaps_coral ? 'rgba(220,38,38,0.3)' : 'rgba(14,165,233,0.25)'}`
                }}>
                  {selectedIncident.vulnerability_details || (selectedIncident.overlaps_coral
                    ? `Coral threat zone: ${selectedIncident.nearest_mpa_name}`
                    : 'Offshore EEZ sector — continuous drift monitoring active')}
                </div>
              </div>
            )}
          </div>



          {/* Legend — horizontal bar below the map, high contrast and clean */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
            padding: '12px 20px', marginTop: 10,
            background: '#ffffff', borderRadius: 12,
            border: '1px solid #cbd5e1', fontSize: '0.8rem', color: '#1e293b',
            boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
          }}>
            <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.74rem', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
              Map Layers:
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 600 }}>
              <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#dc2626', border: '2px solid #fff', boxShadow: '0 0 0 1px #dc2626', display: 'inline-block' }} />
              Critical Spill
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 600 }}>
              <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#ea580c', border: '2px solid #fff', boxShadow: '0 0 0 1px #ea580c', display: 'inline-block' }} />
              High Severity
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 600 }}>
              <span style={{ width: 16, height: 12, borderRadius: 3, background: 'rgba(16, 185, 129, 0.45)', border: '1.5px solid #059669', display: 'inline-block' }} />
              Marine Protected Areas & Coral Sands (Real GIS)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 600 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#1d4ed8', border: '2px solid #fff', display: 'inline-block', boxShadow: '0 0 0 1px #1d4ed8' }} />
              Major Commercial Port
            </span>
          </div>
        </section>

        {/* ── Marine Habitats ── */}
        <section id="habitats" style={{ marginBottom: 60 }}>
          <div className="section-header">
            <div className="section-tag">HABITATS IN PERIL</div>
            <h2 className="section-title">Fragile Coastal Ecosystems Under Protection</h2>
            <p className="section-desc">
              Different coastal environments suffer distinct, compounding injuries when subjected to hydrocarbon spills.
              Select an ecosystem below to inspect its biological mechanisms.
            </p>
          </div>

          <div className="eco-tabs">
            {Object.keys(ecosystems).map(tabId => (
              <button
                key={tabId}
                onClick={() => setActiveTab(tabId)}
                className={`eco-tab ${activeTab === tabId ? 'active' : ''}`}
              >
                {ecoTabLabels[tabId]}
              </button>
            ))}
          </div>

          {ecosystems[activeTab] && (
            <div className="eco-card" key={activeTab}>
              <div className="eco-card-grid">
                {/* Left: Authentic Documentary Photo */}
                <div className="eco-photo-box">
                  <img
                    src={ecosystems[activeTab].image}
                    alt={ecosystems[activeTab].title}
                    className="eco-photo-img"
                  />
                  <div className="eco-photo-meta">
                    <span className="eco-photo-tag">ECOLOGICAL FIELD SURVEY</span>
                    <span className="eco-photo-caption">{ecosystems[activeTab].imageCaption}</span>
                  </div>
                </div>

                {/* Right: Biological Impacts & Action Protocol */}
                <div className="eco-info-box">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14, marginBottom: 16 }}>
                    <div>
                      <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#1a2b3c', margin: 0 }}>
                        {ecosystems[activeTab].title}
                      </h3>
                      <p style={{ fontSize: '0.84rem', color: '#4a6274', fontWeight: 500, margin: '4px 0 0 0' }}>
                        {ecosystems[activeTab].summary}
                      </p>
                    </div>
                    <span className="eco-badge">{ecosystems[activeTab].badge}</span>
                  </div>

                  <p style={{ fontSize: '0.9rem', color: '#4a6274', lineHeight: 1.68, marginBottom: 18 }}>
                    {ecosystems[activeTab].description}
                  </p>

                  <div className="eco-threats-grid">
                    <div>
                      <h4>
                        <AlertTriangleIcon size={16} color="#ef4444" />
                        Primary Vulnerabilities & Threats
                      </h4>
                      <ul>
                        {ecosystems[activeTab].keyThreats.map((threat, idx) => (
                          <li key={idx}>{threat}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="eco-protocol">
                      <h4>
                        <ShieldIcon size={16} color="#5BA4C9" />
                        Emergency Response Protocol
                      </h4>
                      <p>{ecosystems[activeTab].protectionAction}</p>
                      <div className="eco-compliance">
                        <CheckCircleIcon size={14} />
                        NOS-DCP Statutory Protocol Compliant
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ── Statutory Ecological Sensitivity & Marine Indicator Registry ── */}
        <section id="sanctuary-diorama" className="sanctuary-diorama-section">
          {/* Section Header */}
          <div className="section-header" style={{ textAlign: 'center', marginBottom: 28 }}>
            <div className="section-tag" style={{ margin: '0 auto 10px auto' }}>
              <ShieldIcon size={14} color="#0284c7" />
              STATUTORY ECOLOGICAL SENSITIVITY REGISTRY
            </div>
            <h2 className="section-title" style={{ fontSize: '1.8rem', color: '#0f172a' }}>
              Marine Bio-Indicators & Vulnerability Registry
            </h2>
            <p className="section-desc" style={{ maxWidth: 760, margin: '0 auto' }}>
              Standardized classification of 6 primary indicator categories monitored under the National Oil Spill Disaster Contingency Plan (NOS-DCP) and Section 9 of the Wildlife Protection Act.
            </p>
          </div>

          {/* Species Control Bar with View Mode Switcher */}
          {(() => {
            const filteredSpecies = marineSpeciesList.filter(s => speciesFilter === 'all' || s.category === speciesFilter);
            const currentSpecies = filteredSpecies.find(s => s.id === activeSpeciesId) || filteredSpecies[0] || marineSpeciesList[0];

            return (
              <>
                <div className="species-filter-bar">
                  <div className="species-filter-chips">
                    {[
                      { key: 'all', label: 'All Indicators (1–6)' },
                      { key: 'mammal', label: '1 & 2: Marine Mammals & Reptiles' },
                      { key: 'reef', label: '3 & 4: Biogenic Corals & Plankton' },
                      { key: 'benthic', label: '5 & 6: Benthic Invertebrates' },
                    ].map(chip => (
                      <button
                        key={chip.key}
                        className={`species-chip ${speciesFilter === chip.key ? 'active' : ''}`}
                        onClick={() => setSpeciesFilter(chip.key)}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {/* View Switcher: Interactive Console vs Scientific Matrix Table */}
                    <div className="species-view-toggle">
                      <button
                        className={`view-toggle-pill ${speciesViewMode === 'console' ? 'active' : ''}`}
                        onClick={() => setSpeciesViewMode('console')}
                      >
                        Executive Dossier
                      </button>
                      <button
                        className={`view-toggle-pill ${speciesViewMode === 'table' ? 'active' : ''}`}
                        onClick={() => setSpeciesViewMode('table')}
                      >
                        Scientific Matrix
                      </button>
                    </div>

                    <div className="species-count-badge">
                      <ShieldIcon size={13} color="#0284c7" />
                      6 Indicators Monitored
                    </div>
                  </div>
                </div>

                {/* Mode 1: Executive Species Dossier Console */}
                {speciesViewMode === 'console' && (
                  <div className="species-console-layout">
                    {/* Left Telemetry Navigation Rail */}
                    <div className="species-nav-rail">
                      <div className="nav-rail-header">
                        <span className="rail-title">Indicator Roster</span>
                        <span className="rail-count">{filteredSpecies.length} Tracked</span>
                      </div>
                      <div className="species-nav-list">
                        {filteredSpecies.map(sp => {
                          const isActive = sp.id === currentSpecies.id;
                          return (
                            <button
                              key={sp.id}
                              className={`species-nav-card ${isActive ? 'active' : ''}`}
                              onClick={() => setActiveSpeciesId(sp.id)}
                            >
                              <div className="nav-card-num-box">
                                <span className="nav-card-num">{sp.num}</span>
                              </div>
                              <div className="nav-card-info">
                                <div className="nav-card-header-row">
                                  <span className="nav-card-code">INDEX 0{sp.num}</span>
                                  <span className="nav-status-badge">
                                    {sp.status}
                                  </span>
                                </div>
                                <div className="nav-common-name">{sp.commonName}</div>
                                <div className="nav-scientific-name">{sp.scientificName}</div>
                              </div>
                              <div className="nav-card-arrow">→</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Right Command Intelligence Dossier */}
                    <div className="species-dossier-panel">
                      {/* Dossier Top Banner */}
                      <div className="dossier-banner">
                        <div className="dossier-header-main">
                          <div className="dossier-num-tile">
                            <span className="dossier-num-label">INDEX</span>
                            <span className="dossier-num-val">0{currentSpecies.num}</span>
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                              <span className="dossier-code-pill">ESI REF: BIO-0{currentSpecies.num}</span>
                              <span className="dossier-status-pill">
                                {currentSpecies.status}
                              </span>
                              <span className="dossier-class-tag">{currentSpecies.taxonomicClass}</span>
                            </div>
                            <h3 className="dossier-title">{currentSpecies.commonName}</h3>
                            <div className="dossier-binomial">Binomial Taxonomy: <em>{currentSpecies.scientificName}</em></div>
                          </div>
                        </div>

                        <div className="dossier-metrics-strip">
                          <div className="metric-chip">
                            <span className="metric-lbl">Primary Sanctuary Habitat</span>
                            <span className="metric-val" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <MapPinIcon size={12} color="#0369a1" />
                              {currentSpecies.habitat}
                            </span>
                          </div>
                          <div className="metric-chip">
                            <span className="metric-lbl">Trophic Role</span>
                            <span className="metric-val">{currentSpecies.trophicRole}</span>
                          </div>
                          <div className="metric-chip">
                            <span className="metric-lbl">Sensitivity Classification</span>
                            <span className="metric-val">{currentSpecies.sensitivity}</span>
                          </div>
                        </div>
                      </div>

                      {/* Dual Intelligence Columns: Threat vs Safeguard */}
                      <div className="dossier-dual-columns">
                        {/* Left: Hydrocarbon Threat Pathology */}
                        <div className="dossier-column threat-column">
                          <div className="column-header">
                            <div className="col-tag threat-tag">
                              <AlertTriangleIcon size={13} color="#475569" />
                              Toxicological Pathology & Exposure Risk
                            </div>
                            <span className="vector-badge">{currentSpecies.threatVector}</span>
                          </div>

                          <p className="column-description">{currentSpecies.threat}</p>

                          <div className="pathology-tags-wrap">
                            <span className="tags-label">Clinical Manifestations:</span>
                            <div className="tags-cluster">
                              {currentSpecies.threatTags?.map((tag, i) => (
                                <span key={i} className="pathology-tag">{tag}</span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Right: Statutory NOS-DCP Response Safeguard */}
                        <div className="dossier-column safeguard-column">
                          <div className="column-header">
                            <div className="col-tag safeguard-tag">
                              <ShieldIcon size={13} color="#475569" />
                              Mandatory NOS-DCP Tactical Safeguard
                            </div>
                            <span className="rule-badge">{currentSpecies.safeguardRule}</span>
                          </div>

                          <p className="column-description">{currentSpecies.safeguard}</p>

                          <div className="pathology-tags-wrap">
                            <span className="tags-label">Operational Countermeasures:</span>
                            <div className="tags-cluster">
                              {currentSpecies.safeguardTags?.map((tag, i) => (
                                <span key={i} className="safeguard-tag-pill">{tag}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Dossier Bottom Action Bar */}
                      <div className="dossier-footer">
                        <div className="dossier-statutory-notice">
                          <ShieldIcon size={14} color="#0369a1" />
                          <span>Enforced under Section 9 of the Wildlife Protection Act (1972) and NOS-DCP National Directives.</span>
                        </div>
                        <a href="#surveillance-map" className="dossier-map-link">
                          Locate Sanctuary on Radar Map →
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {/* Mode 2: Scientific Matrix Registry Table */}
                {speciesViewMode === 'table' && (
                  <div className="species-matrix-container">
                    <table className="species-matrix-table">
                      <thead>
                        <tr>
                          <th>Indicator Species</th>
                          <th>Taxonomy / Role</th>
                          <th>Conservation Status</th>
                          <th>Core Sanctuary Range</th>
                          <th>Hydrocarbon Sensitivity Threat</th>
                          <th>NOS-DCP Response Protocol</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSpecies.map(sp => (
                          <tr
                            key={sp.id}
                            onClick={() => { setActiveSpeciesId(sp.id); setSpeciesViewMode('console'); }}
                            style={{ cursor: 'pointer' }}
                            title="Click to open executive dossier"
                          >
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div className="matrix-num-pill">{sp.num}</div>
                                <div>
                                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.5px', marginBottom: 2 }}>INDEX 0{sp.num}</div>
                                  <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.86rem' }}>{sp.commonName}</div>
                                  <div style={{ fontStyle: 'italic', fontSize: '0.74rem', color: '#64748b' }}>{sp.scientificName}</div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#334155' }}>{sp.taxonomicClass}</div>
                              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{sp.trophicRole}</div>
                            </td>
                            <td>
                              <span className="dossier-status-pill">
                                {sp.status}
                              </span>
                            </td>
                            <td>
                              <div style={{ fontSize: '0.78rem', color: '#0369a1', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <MapPinIcon size={12} color="#0369a1" />
                                {sp.habitat}
                              </div>
                            </td>
                            <td style={{ maxWidth: 260 }}>
                              <div style={{ fontSize: '0.76rem', color: '#334155', lineHeight: 1.45, background: '#f8fafc', padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                                {sp.threat}
                              </div>
                            </td>
                            <td style={{ maxWidth: 260 }}>
                              <div style={{ fontSize: '0.76rem', color: '#334155', lineHeight: 1.45, background: '#f8fafc', padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                                {sp.safeguard}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            );
          })()}
        </section>

        {/* ── Spill Science ── */}
        <section id="impact" style={{ marginBottom: 60 }}>
          <div className="section-header">
            <div className="section-tag">ECOLOGICAL MECHANISMS</div>
            <h2 className="section-title">The Anatomy of an Oil Spill: Three Layers of Impact</h2>
            <p className="section-desc">
              Spilled petroleum does not stay on the surface; it undergoes weathering, emulsification,
              and sedimentation, impacting every marine stratum.
            </p>
          </div>

          <div className="impact-grid">
            <div className="impact-card">
              <div className="impact-stratum">STRATUM 1: SEA SURFACE</div>
              <h3>Atmospheric & Surface Blockade</h3>
              <p>
                A thin film of oil creates an impenetrable barrier at the air-water boundary.
                It blocks sunlight required by phytoplankton, which generate more than half of the planet's oxygen.
                Marine birds that dive into slicks lose the water-repellent insulation of their plumage, leading to hypothermia,
                while surfacing dolphins inhale volatile aromatic hydrocarbons that trigger pulmonary edema.
              </p>
              <div className="impact-victims">
                <strong>Key victim species:</strong> Terns, pelicans, surfacing sea turtles, dolphin pods.
              </div>
            </div>

            <div className="impact-card">
              <div className="impact-stratum">STRATUM 2: WATER COLUMN</div>
              <h3>Dispersion & Bioaccumulation</h3>
              <p>
                As ocean wave energy breaks the slick into droplets, toxic Polycyclic Aromatic Hydrocarbons (PAHs) dissolve
                into the water column. Microscopic zooplankton and fish larvae ingest these micro-droplets, experiencing high mortality.
                Toxic residues bioaccumulate in filter feeders like oysters and clams, magnifying in concentration as they travel up
                the food web to mackerel, kingfish, and human consumers.
              </p>
              <div className="impact-victims">
                <strong>Key victim species:</strong> Fish fry, pelagic shoals, bivalves, zooplankton.
              </div>
            </div>

            <div className="impact-card">
              <div className="impact-stratum">STRATUM 3: SEABED & SHORELINE</div>
              <h3>Benthic & Sediment Smothering</h3>
              <p>
                Heavier crude fractions, known as asphaltenes, bind with suspended sediment and sink onto the ocean floor.
                They smother coral heads, destroy subtidal seagrass meadows where dugongs graze, and coat intertidal sandy beaches.
                Because oxygen levels beneath buried sediment are minimal, heavy tar can persist for decades, continuously leaching
                toxins into intertidal crab burrows and turtle nesting pits.
              </p>
              <div className="impact-victims">
                <strong>Key victim species:</strong> Coral polyps, seagrass beds, benthic crabs, intertidal snails.
              </div>
            </div>
          </div>
        </section>

        {/* ── Sanctuaries ── */}
        <section id="sanctuaries" style={{ marginBottom: 60 }}>
          <div className="section-header">
            <div className="section-tag">PROTECTED MARINE ASSETS</div>
            <h2 className="section-title">Key Marine Protected Areas of India</h2>
            <p className="section-desc">
              These coastal reserves preserve genetic diversity, buffer communities against storm surges,
              and represent priceless ecological heritage.
            </p>
          </div>

          <div className="sanctuary-grid">
            {sanctuaries.map((sanctuary, idx) => (
              <div key={idx} className="sanctuary-card">
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span className="sanctuary-state-tag">{sanctuary.state}</span>
                  </div>
                  <h3>{sanctuary.name}</h3>
                  <div className="sanctuary-highlight">★ {sanctuary.highlight}</div>
                  <p>{sanctuary.desc}</p>
                </div>
                <div className="sanctuary-footer">
                  <span className="tier-label">Environmental Tier:</span>
                  <span className="tier-value">{sanctuary.priority}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Reporting Guide ── */}
        <section id="report" className="report-section">
          <div className="section-header">
            <div className="section-tag">PUBLIC DEFENSE PROTOCOL</div>
            <h2 className="section-title">What To Do If You Spot Marine Pollution</h2>
            <p className="section-desc">
              Coastal tourists, morning beach walkers, and artisanal fisherfolk are often the first to detect offshore slicks.
              Follow this verified protocol to alert authorities safely.
            </p>
          </div>

          <div className="report-steps">
            {[
              { num: 1, title: 'Spot & Identify', desc: 'Recognize signs: iridescent rainbow sheen on water, black emulsified sludge, pungent diesel or tar odors, or sticky tarballs deposited at the high-tide line.' },
              { num: 2, title: 'Safety & Distance', desc: 'Never touch tarballs or breathe concentrated fumes directly. Keep children and domestic pets out of contaminated surf. Hydrocarbon vapors contain carcinogenic volatile benzenes.' },
              { num: 3, title: 'Call Toll-Free 1554', desc: 'Dial the Indian Coast Guard 24/7 Maritime Pollution Hotline at 1554 or notify the nearest Marine Police station and Port Authority office immediately.' },
              { num: 4, title: 'Record Details', desc: 'Provide exact landmark or smartphone GPS coordinates, time observed, estimated shoreline length affected, and photograph the slick from a safe elevation.' },
            ].map(step => (
              <div key={step.num} className="report-step">
                <div className="step-number">{step.num}</div>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </div>
            ))}
          </div>

          <div className="wildlife-warning">
            <div className="wildlife-warning-icon">
              <BirdIcon size={24} color="#f87171" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#f87171', marginBottom: 2 }}>
                Critical Oiled Wildlife Warning
              </div>
              <div style={{ fontSize: '0.8rem', color: '#5a7a8f', lineHeight: 1.55 }}>
                Do NOT attempt to wash oiled seabirds or turtles with household detergent. Untrained washing destroys natural
                feather waterproofing and leads to fatal shock. Trained marine veterinarian units deploy specialized temperature-controlled
                stabilization baths.
              </div>
            </div>
          </div>
        </section>

        {/* ── Multilingual Coastal Community & Fishermen Safety Advisory (Qualcomm Cloud AI) ── */}
        <section id="coastal-advisory" style={{
          background: 'linear-gradient(180deg, #ffffff 0%, #f0f9ff 100%)',
          border: '1.5px solid #bae6fd',
          borderRadius: '20px',
          padding: '40px 32px',
          marginBottom: '60px',
          boxShadow: '0 10px 30px -10px rgba(2, 132, 199, 0.12)'
        }}>
          <div className="section-header" style={{ textAlign: 'center', marginBottom: 28 }}>
            <div className="section-tag" style={{ margin: '0 auto 10px auto', background: '#e0f2fe', color: '#0369a1', borderColor: '#7dd3fc' }}>
              COMMUNITY SAFETY INTELLIGENCE · QUALCOMM CLOUD AI
            </div>
            <h2 className="section-title" style={{ fontSize: '1.85rem', color: '#0f2e59' }}>
              Multilingual Coastal Community & Fishermen Safety Advisory
            </h2>
            <p className="section-desc" style={{ maxWidth: 760, margin: '0 auto', color: '#475569' }}>
              Direct, plain-language marine safety advisories translated for coastal fishing villages, harbor masters, and beachgoers into 5 official Indian languages via <strong>Qualcomm Cloud AI Playground (Llama-3.3-70B)</strong>.
            </p>
          </div>

          {/* Language Switcher Bar */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            marginBottom: 24
          }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginRight: 4 }}>
              Select Language:
            </span>
            {[
              { code: 'en', label: 'English', native: 'English' },
              { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
              { code: 'te', label: 'Telugu', native: 'తెలుగు' },
              { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
              { code: 'ml', label: 'Malayalam', native: 'മലയാളം' },
            ].map(lang => (
              <button
                key={lang.code}
                onClick={() => setAdvisoryLang(lang.code)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '30px',
                  border: advisoryLang === lang.code ? '2px solid #0284c7' : '1px solid #cbd5e1',
                  background: advisoryLang === lang.code ? '#0284c7' : '#ffffff',
                  color: advisoryLang === lang.code ? '#ffffff' : '#1e293b',
                  fontWeight: advisoryLang === lang.code ? 700 : 500,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: advisoryLang === lang.code ? '0 4px 12px rgba(2, 132, 199, 0.25)' : 'none'
                }}
              >
                {lang.native} ({lang.label})
              </button>
            ))}
          </div>

          {/* Main Advisory Display Card */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '28px',
            maxWidth: 880,
            margin: '0 auto',
            boxShadow: '0 4px 16px rgba(0,0,0,0.04)'
          }}>
            {/* Header info badge bar */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              paddingBottom: 16,
              borderBottom: '1px solid #f1f5f9',
              marginBottom: 20
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#dc2626',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626', display: 'inline-block' }} />
                  ACTIVE SLICK ADVISORY
                </span>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Sector: <strong>{advisoryData?.region || 'West Coast / Arabian Sea'}</strong>
                </span>
              </div>
              <div style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                color: '#15803d',
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '0.72rem',
                fontWeight: 600
              }}>
                ⚡ Qualcomm Cloud AI (Llama-3.3-70B) · Grounded Synthesis
              </div>
            </div>

            {/* Title */}
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f2e59', marginBottom: 16 }}>
              {advisoryData?.title || 'Coastal Marine Safety & Fishermen Advisory'}
            </h3>

            {/* Body */}
            {loadingAdvisory ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                <div style={{ fontSize: '0.9rem', marginBottom: 6 }}>Synthesizing advisory with Qualcomm Cloud AI...</div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Translating into local regional language with strict coastal safety directives</div>
              </div>
            ) : (
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '20px',
                color: '#1e293b',
                fontSize: '0.94rem',
                lineHeight: 1.7,
                whiteSpace: 'pre-line',
                fontFamily: advisoryLang === 'en' ? 'inherit' : 'sans-serif'
              }}>
                {advisoryData?.advisory || 'Loading advisory...'}
              </div>
            )}

            {/* Action Bar */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              marginTop: 20,
              paddingTop: 16,
              borderTop: '1px solid #f1f5f9'
            }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  onClick={handleToggleSpeak}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid #0284c7',
                    background: speakingAdvisory ? '#0284c7' : '#f0f9ff',
                    color: speakingAdvisory ? '#ffffff' : '#0284c7',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <span>{speakingAdvisory ? '⏹ Stop Audio' : '🔊 Listen to Advisory (Voice)'}</span>
                </button>

                <button
                  onClick={handleCopyAdvisory}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#334155',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    cursor: 'pointer'
                  }}
                >
                  <span>{copiedAdvisory ? '✓ Copied to Clipboard!' : '📋 Copy for WhatsApp / Broadcast'}</span>
                </button>
              </div>

              <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                Coast Guard Emergency 24/7 Hotline: <strong style={{ color: '#dc2626', fontSize: '0.9rem' }}>1554</strong>
              </div>
            </div>
          </div>
        </section>

        {/* ── Pledge ── */}
        <section id="pledge" className="pledge-section">
          <div style={{ maxWidth: 780, margin: '0 auto', textAlign: 'center' }}>
            <div className="section-tag">COMMUNITY STEWARDSHIP</div>
            <h2 className="section-title" style={{ marginTop: 12 }}>
              Take the SARVAS Clean Seas Marine Protection Pledge
            </h2>
            <p style={{ color: '#4a6274', fontSize: '0.92rem', margin: '8px auto 28px', lineHeight: 1.6 }}>
              Protecting 7,500+ km of ocean requires vigilant eyes across every fishing village, tourist beach, and harbor.
              Stand together with thousands of coastal protectors across India.
            </p>

            {pledgeSigned ? (
              <div className="pledge-success">
                <CheckCircleIcon size={48} color="#5BA4C9" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1a2b3c', marginTop: 12 }}>
                  Thank you for standing up as a SARVAS Marine Guardian!
                </h3>
                <p style={{ fontSize: '0.86rem', color: '#4a6274', marginTop: 8 }}>
                  You have joined <strong style={{ color: '#2980b9' }}>{pledgeCount.toLocaleString()}</strong> citizens
                  committed to defending India's marine flora and fauna.
                </p>
                <div style={{ marginTop: 16, fontSize: '0.76rem', color: '#1a6fa0', fontWeight: 700 }}>
                  ✓ Pledge Badge Registered · National Marine Awareness Initiative
                </div>
              </div>
            ) : (
              <form onSubmit={handlePledgeSubmit} className="pledge-form" style={{ textAlign: 'left' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                  <label className="pledge-checkbox-label">
                    <input type="checkbox" checked={checkedPledges.report} onChange={(e) => setCheckedPledges({ ...checkedPledges, report: e.target.checked })} />
                    <span>I pledge to immediately report observed ocean slicks, tarballs, or vessel discharge to emergency 1554.</span>
                  </label>
                  <label className="pledge-checkbox-label">
                    <input type="checkbox" checked={checkedPledges.plastic} onChange={(e) => setCheckedPledges({ ...checkedPledges, plastic: e.target.checked })} />
                    <span>I pledge to eliminate single-use plastics during beach visits to avoid entangling marine wildlife.</span>
                  </label>
                  <label className="pledge-checkbox-label">
                    <input type="checkbox" checked={checkedPledges.wildlife} onChange={(e) => setCheckedPledges({ ...checkedPledges, wildlife: e.target.checked })} />
                    <span>I pledge to respect Marine Protected Areas, stay on designated paths, and never disturb turtle nesting grounds.</span>
                  </label>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
                  <div style={{ fontSize: '0.8rem', color: '#5a7a8f' }}>
                    Join <strong style={{ color: '#2980b9' }}>{pledgeCount.toLocaleString()}</strong> registered ocean stewards
                  </div>
                  <button type="submit" className="pledge-submit-btn">
                    Sign Clean Seas Pledge
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>

        {/* ── FAQ ── */}
        <section style={{ marginBottom: 40 }}>
          <div className="section-header">
            <div className="section-tag">KNOWLEDGE BASE</div>
            <h2 className="section-title">Frequently Asked Environmental Questions</h2>
            <p className="section-desc">
              Clear, scientifically grounded answers to common public inquiries on marine disaster response.
            </p>
          </div>

          <div className="faq-container">
            {faqs.map((faq, idx) => (
              <div key={idx} className="faq-item">
                <button onClick={() => toggleFaq(idx)} className="faq-question">
                  <span>{faq.q}</span>
                  <span className="faq-toggle">{openFaq === idx ? '−' : '+'}</span>
                </button>
                {openFaq === idx && (
                  <div className="faq-answer">{faq.a}</div>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* ────────── Footer ────────── */}
      <footer className="page-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <div className="nav-brand-icon" style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              padding: 0,
              overflow: 'hidden',
              background: 'transparent',
              border: '2px solid rgba(2, 132, 199, 0.4)',
              flexShrink: 0
            }}>
              <img
                src="/sarvas_logo.png"
                alt="SARVAS Logo"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            <span className="footer-brand-name">SARVAS — FROM SLICK TO SUSPECT</span>
          </div>

          <p className="footer-description">
            Dedicated to open environmental transparency, public disaster awareness, and the preservation
            of coral reef sanctuaries and artisanal coastal livelihoods. Operating in alignment with the
            National Oil Spill Disaster Contingency Plan (NOS-DCP).
          </p>

          <div className="footer-emergency-bar">
            <span>Maritime Pollution: <strong>1554</strong></span>
            <span className="footer-divider-sep">|</span>
            <span>Wildlife Emergency: <strong>1800-11-9300</strong></span>
            <span className="footer-divider-sep">|</span>
            <span>Coast Guard Helpline: <strong>1938</strong></span>
          </div>

          <div className="footer-bottom">
            <div>© 2026 Coastal Environmental Transparency & Disaster Support Program. All Rights Reserved.</div>
            <div>
              For authorized officers:
              <Link to="/login" style={{ marginLeft: 8 }}>
                Sign in to Operational Command →
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
