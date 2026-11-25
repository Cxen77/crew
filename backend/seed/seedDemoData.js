import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import dbConnect from '../config/db.js';
import Club from '../models/Club.js';
import Event from '../models/Event.js';
import Volunteer from '../models/Volunteer.js';
import EventParticipant from '../models/EventParticipant.js';
import DecisionLog from '../models/DecisionLog.js';
import { runAgentCycle } from '../agent/orchestrator.js';

dotenv.config();

function dayAt(offsetDays, hour, minute = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, minute, 0, 0);
  return d;
}

export async function seedDatabase({ runAgent = true } = {}) {
  await Promise.all([
    Club.deleteMany({}),
    Event.deleteMany({}),
    Volunteer.deleteMany({}),
    EventParticipant.deleteMany({}),
    DecisionLog.deleteMany({}),
  ]);

  const clubsData = [
    {
      name: 'CodeCraft',
      description: 'Campus software engineering, hackathons, and open-source builders collective.',
      category: 'Tech & Coding',
      tags: ['software', 'hackathon', 'ai', 'web', 'sustainability'],
      currentFocus: 'Annual 24h Campus Build Sprint & Mentorship',
      projectGoals: 'Ship practical campus tools and host beginner-friendly coding sprints.',
      teamStatus: 'active',
      memberCount: 78,
      lastEventDate: dayAt(-5, 10),
      lastActivityAt: dayAt(-1, 14),
      postsLast30Days: 14,
      memberCountHistory: [
        { month: 'Aug', count: 64 },
        { month: 'Sep', count: 70 },
        { month: 'Oct', count: 74 },
        { month: 'Nov', count: 78 },
      ],
      members: [
        { name: 'Aarav Nair', role: 'owner' },
        { name: 'Diya Kulkarni', role: 'co-lead' },
        { name: 'Rohan Bansal', role: 'member' },
      ],
      openRoles: [
        {
          title: 'Frontend Workshop Mentor',
          description: 'Help first-year students build React dashboards.',
          requiredSkills: ['react', 'javascript', 'mentoring'],
          vacancies: 2,
          filledCount: 0,
          isOpen: true,
        },
      ],
      isLookingForMembers: true,
    },
    {
      name: 'Rhythmix',
      description: 'Campus acoustic bands, vocal ensembles, and live audio production crew.',
      category: 'Music & Audio',
      tags: ['music', 'stage', 'performing-arts', 'cultural', 'evening-showcase'],
      currentFocus: 'Unplugged Sunset Series & Live Sound Mixing',
      projectGoals: 'Bring live student music to campus open-air spaces every fortnight.',
      teamStatus: 'active',
      memberCount: 54,
      lastEventDate: dayAt(-9, 18),
      lastActivityAt: dayAt(-2, 16),
      postsLast30Days: 9,
      memberCountHistory: [
        { month: 'Aug', count: 48 },
        { month: 'Sep', count: 50 },
        { month: 'Oct', count: 52 },
        { month: 'Nov', count: 54 },
      ],
      members: [
        { name: 'Meera Iyer', role: 'owner' },
        { name: 'Siddharth Menon', role: 'co-lead' },
      ],
      openRoles: [],
      isLookingForMembers: false,
    },
    {
      name: 'Shutterbug',
      description: 'Photography, visual storytelling, astrophotography, and campus media crew.',
      category: 'Photography & Visual Arts',
      tags: ['photography', 'night-sky', 'optics', 'outdoors', 'visual-arts'],
      currentFocus: 'Campus Documentary & Long-Exposure Night Walks',
      projectGoals: 'Document campus culture and teach visual composition with hands-on photowalks.',
      teamStatus: 'active',
      memberCount: 46,
      lastEventDate: dayAt(-6, 17),
      lastActivityAt: dayAt(-1, 18),
      postsLast30Days: 11,
      memberCountHistory: [
        { month: 'Aug', count: 38 },
        { month: 'Sep', count: 41 },
        { month: 'Oct', count: 44 },
        { month: 'Nov', count: 46 },
      ],
      members: [
        { name: 'Tara Deshmukh', role: 'owner' },
        { name: 'Vikram Joshi', role: 'co-lead' },
      ],
      openRoles: [],
      isLookingForMembers: false,
    },
    {
      name: 'RoboKriti',
      description: 'Autonomous robotics, embedded hardware, drones, and combat bot engineering.',
      category: 'Robotics & Hardware',
      tags: ['robotics', 'hardware', 'iot', 'software', 'ai'],
      currentFocus: 'Autonomous Line-Follower & ROS2 Lab',
      projectGoals: 'Build competition-ready autonomous bots and mentor hardware newcomers.',
      teamStatus: 'active',
      memberCount: 52,
      lastEventDate: dayAt(-11, 11),
      lastActivityAt: dayAt(-2, 12),
      postsLast30Days: 8,
      memberCountHistory: [
        { month: 'Aug', count: 45 },
        { month: 'Sep', count: 49 },
        { month: 'Oct', count: 50 },
        { month: 'Nov', count: 52 },
      ],
      members: [
        { name: 'Karan Malhotra', role: 'owner' },
        { name: 'Neha Sharma', role: 'co-lead' },
      ],
      openRoles: [],
      isLookingForMembers: false,
    },
    {
      name: 'LitSoc',
      description: 'Creative writing, spoken word poetry, campus zines, and literary critique.',
      category: 'Literature & Writing',
      tags: ['writing', 'poetry', 'storytelling', 'debate', 'cultural'],
      currentFocus: 'Autumn Anthology & Spoken Word Open Mic',
      projectGoals: 'Publish quarterly campus fiction and host weekly critique circles.',
      teamStatus: 'active',
      memberCount: 39,
      lastEventDate: dayAt(-12, 16),
      lastActivityAt: dayAt(-3, 15),
      postsLast30Days: 6,
      memberCountHistory: [
        { month: 'Aug', count: 36 },
        { month: 'Sep', count: 37 },
        { month: 'Oct', count: 38 },
        { month: 'Nov', count: 39 },
      ],
      members: [
        { name: 'Aditi Sen', role: 'owner' },
        { name: 'Pranav Kapoor', role: 'co-lead' },
      ],
      openRoles: [],
      isLookingForMembers: false,
    },
    {
      name: 'GreenHands',
      description: 'Campus sustainability, zero-waste drives, urban gardening, and climate tech.',
      category: 'Sustainability & Environment',
      tags: ['sustainability', 'outdoors', 'community', 'climate', 'wellness'],
      currentFocus: 'Zero-Waste Campus Festivals & Solar Audit',
      projectGoals: 'Cut event plastic waste by 80% across all student clubs.',
      teamStatus: 'active',
      memberCount: 44,
      lastEventDate: dayAt(-5, 10),
      lastActivityAt: dayAt(-2, 10),
      postsLast30Days: 7,
      memberCountHistory: [
        { month: 'Aug', count: 39 },
        { month: 'Sep', count: 40 },
        { month: 'Oct', count: 42 },
        { month: 'Nov', count: 44 },
      ],
      members: [
        { name: 'Riya Chatterjee', role: 'owner' },
        { name: 'Arjun Pillai', role: 'co-lead' },
      ],
      openRoles: [],
      isLookingForMembers: false,
    },
    {
      name: 'Nritya',
      description: 'Contemporary, classical, and street dance troupe producing seasonal stage shows.',
      category: 'Dance & Performing Arts',
      tags: ['dance', 'stage', 'performing-arts', 'cultural', 'evening-showcase'],
      currentFocus: 'Contemporary Fusion Showcase Choreography',
      projectGoals: 'Collaborate with live campus musicians for interdisciplinary stage nights.',
      teamStatus: 'active',
      memberCount: 49,
      lastEventDate: dayAt(-8, 18),
      lastActivityAt: dayAt(-1, 19),
      postsLast30Days: 10,
      memberCountHistory: [
        { month: 'Aug', count: 43 },
        { month: 'Sep', count: 45 },
        { month: 'Oct', count: 47 },
        { month: 'Nov', count: 49 },
      ],
      members: [
        { name: 'Sanya Mirza', role: 'owner' },
        { name: 'Devika Nair', role: 'co-lead' },
      ],
      openRoles: [],
      isLookingForMembers: false,
    },
    {
      name: 'Debate Circle',
      description: 'Parliamentary debate, Model UN, public policy roundtables, and rhetoric workshops.',
      category: 'Oratory & Policy',
      tags: ['debate', 'policy', 'speaking', 'storytelling', 'civic'],
      currentFocus: 'Inter-Department Parliamentary Debate League',
      projectGoals: 'Sharpen critical argumentation and public speaking across campus.',
      teamStatus: 'active',
      memberCount: 41,
      lastEventDate: dayAt(-10, 15),
      lastActivityAt: dayAt(-4, 17),
      postsLast30Days: 5,
      memberCountHistory: [
        { month: 'Aug', count: 40 },
        { month: 'Sep', count: 40 },
        { month: 'Oct', count: 41 },
        { month: 'Nov', count: 41 },
      ],
      members: [
        { name: 'Harsh Vardhan', role: 'owner' },
        { name: 'Nandini Rao', role: 'co-lead' },
      ],
      openRoles: [],
      isLookingForMembers: false,
    },
    {
      name: 'AstroClub',
      description: 'Telescope observation nights, deep-sky imaging, and astrophysics discussions.',
      category: 'Astronomy & Space',
      tags: ['astronomy', 'night-sky', 'optics', 'outdoors', 'photography'],
      currentFocus: 'Needs revival — telescope calibration & beginner skywatch',
      projectGoals: 'Make night-sky observation accessible to every student on campus.',
      teamStatus: 'paused',
      memberCount: 18,
      lastEventDate: dayAt(-75, 20), // 75 days ago!
      lastActivityAt: dayAt(-62, 19),
      postsLast30Days: 0, // 0 posts in 30 days!
      memberCountHistory: [
        { month: 'Aug', count: 42 },
        { month: 'Sep', count: 31 },
        { month: 'Oct', count: 23 },
        { month: 'Nov', count: 18 },
      ],
      members: [
        { name: 'Mihir Kulkarni', role: 'owner' },
      ],
      openRoles: [
        {
          title: 'Night Sky Session Coordinator',
          description: 'Help organize rooftop stargazing sessions and outreach.',
          requiredSkills: ['coordination', 'outdoors', 'communication'],
          vacancies: 2,
          filledCount: 0,
          isOpen: true,
        },
      ],
      isLookingForMembers: true,
    },
    {
      name: 'FitFam',
      description: 'Morning run clubs, calisthenics, mindfulness walks, and campus wellness challenges.',
      category: 'Fitness & Wellness',
      tags: ['wellness', 'outdoors', 'community', 'morning', 'sports'],
      currentFocus: '5K Sunrise Campus Loop & Mobility Clinics',
      projectGoals: 'Promote consistent student physical & mental wellness habits.',
      teamStatus: 'active',
      memberCount: 62,
      lastEventDate: dayAt(-3, 7),
      lastActivityAt: dayAt(-1, 8),
      postsLast30Days: 12,
      memberCountHistory: [
        { month: 'Aug', count: 52 },
        { month: 'Sep', count: 55 },
        { month: 'Oct', count: 59 },
        { month: 'Nov', count: 62 },
      ],
      members: [
        { name: 'Vikrant Singh', role: 'owner' },
        { name: 'Pooja Hegde', role: 'co-lead' },
      ],
      openRoles: [],
      isLookingForMembers: false,
    },
  ];

  const clubs = await Club.insertMany(clubsData);
  const clubByName = new Map(clubs.map((c) => [c.name, c]));

  // Create ~25 events over 2 weeks + 1 completed event (5 days ago)
  const eventsData = [
    // Completed event for Report Generator demo
    {
      title: 'EcoHack Sprint 2026',
      description: 'Cross-club sustainability & civic-tech build sprint focused on campus energy and waste reduction.',
      clubId: clubByName.get('CodeCraft')._id,
      collaboratingClubIds: [clubByName.get('GreenHands')._id],
      startAt: dayAt(-5, 9, 0),
      endAt: dayAt(-5, 18, 0),
      venue: 'Main Auditorium',
      category: 'Hackathon',
      tags: ['hackathon', 'sustainability', 'software'],
      status: 'completed',
      expectedAttendance: 50,
    },

    // PLANTED CLASH 1: CodeCraft Hackathon Kickoff vs RoboKriti Workshop — Tomorrow 10:00–13:00, Seminar Hall A
    {
      title: 'CodeCraft 24h Hackathon Kickoff',
      description: 'Opening ceremony, problem statement briefing, and team formation for the flagship campus hackathon.',
      clubId: clubByName.get('CodeCraft')._id,
      startAt: dayAt(1, 10, 0),
      endAt: dayAt(1, 13, 0),
      venue: 'Seminar Hall A',
      category: 'Hackathon',
      tags: ['hackathon', 'software', 'ai'],
      status: 'scheduled',
      expectedAttendance: 110,
      openRoles: [
        {
          title: 'Event Photographer',
          requiredSkills: ['photography', 'editing', 'dslr'],
          vacancies: 1,
          filledCount: 0,
          assignedVolunteerIds: [],
          isOpen: true,
        },
        {
          title: 'Registration Desk Lead',
          requiredSkills: ['coordination', 'check-in', 'communication'],
          vacancies: 1,
          filledCount: 0,
          assignedVolunteerIds: [],
          isOpen: true,
        },
      ],
    },
    {
      title: 'RoboKriti Autonomous Bot Workshop',
      description: 'Hands-on PID control, sensor calibration, and micro-controller debugging clinic.',
      clubId: clubByName.get('RoboKriti')._id,
      startAt: dayAt(1, 10, 0),
      endAt: dayAt(1, 13, 0),
      venue: 'Seminar Hall A',
      category: 'Workshop',
      tags: ['robotics', 'hardware', 'iot'],
      status: 'scheduled',
      expectedAttendance: 65,
    },

    // PLANTED CLASH 2 (Collaboration Fix): Rhythmix Concert vs Nritya Rehearsal — Day +2, 18:00–20:30, Open Air Theatre
    {
      title: 'Rhythmix Acoustic Sunset Concert',
      description: 'Unplugged evening set featuring three student indie bands and live sound engineering.',
      clubId: clubByName.get('Rhythmix')._id,
      startAt: dayAt(2, 18, 0),
      endAt: dayAt(2, 20, 30),
      venue: 'Open Air Theatre',
      category: 'Concert',
      tags: ['music', 'stage', 'cultural'],
      status: 'scheduled',
      expectedAttendance: 140,
    },
    {
      title: 'Nritya Contemporary Showcase Rehearsal',
      description: 'Full-stage lighting & choreography run-through for the semester cultural showcase.',
      clubId: clubByName.get('Nritya')._id,
      startAt: dayAt(2, 18, 0),
      endAt: dayAt(2, 20, 30),
      venue: 'Open Air Theatre',
      category: 'Performance',
      tags: ['dance', 'stage', 'cultural'],
      status: 'scheduled',
      expectedAttendance: 75,
    },

    // PLANTED CLASH 3: LitSoc double-booked against itself — Day +3, 15:00–17:00
    {
      title: 'LitSoc Poetry Slam Qualifiers',
      description: 'Live spoken word slam qualifiers with faculty and alumni judges.',
      clubId: clubByName.get('LitSoc')._id,
      startAt: dayAt(3, 15, 0),
      endAt: dayAt(3, 17, 0),
      venue: 'Main Auditorium',
      category: 'Performance',
      tags: ['poetry', 'writing', 'speaking'],
      status: 'scheduled',
      expectedAttendance: 80,
    },
    {
      title: 'LitSoc Fiction Critique Circle',
      description: 'Small-group short story feedback session for the autumn zine.',
      clubId: clubByName.get('LitSoc')._id,
      startAt: dayAt(3, 15, 30),
      endAt: dayAt(3, 17, 0),
      venue: 'Seminar Hall C',
      category: 'Meetup',
      tags: ['writing', 'storytelling'],
      status: 'scheduled',
      expectedAttendance: 25,
    },

    // Additional clean scheduled events across the 2-week calendar (~25 total)
    {
      title: 'FitFam Sunrise 5K Campus Loop',
      description: 'Guided warm-up, 5K community pace run, and hydration recovery.',
      clubId: clubByName.get('FitFam')._id,
      startAt: dayAt(0, 6, 30),
      endAt: dayAt(0, 8, 0),
      venue: 'Campus Quad',
      category: 'Wellness',
      tags: ['wellness', 'outdoors'],
      status: 'scheduled',
      expectedAttendance: 55,
    },
    {
      title: 'Shutterbug Golden Hour Portrait Lab',
      description: 'Natural light framing and manual exposure practice around the quad.',
      clubId: clubByName.get('Shutterbug')._id,
      startAt: dayAt(0, 17, 0),
      endAt: dayAt(0, 18, 30),
      venue: 'Campus Quad',
      category: 'Workshop',
      tags: ['photography', 'outdoors'],
      status: 'scheduled',
      expectedAttendance: 35,
    },
    {
      title: 'Debate Circle Parliamentary Sparring',
      description: 'Asian Parliamentary format practice motions on AI governance.',
      clubId: clubByName.get('Debate Circle')._id,
      startAt: dayAt(1, 16, 0),
      endAt: dayAt(1, 18, 0),
      venue: 'Seminar Hall C',
      category: 'Tournament',
      tags: ['debate', 'policy'],
      status: 'scheduled',
      expectedAttendance: 40,
    },
    {
      title: 'GreenHands Campus Composting Drive',
      description: 'Hands-on hostel waste sorting & organic compost pit setup.',
      clubId: clubByName.get('GreenHands')._id,
      startAt: dayAt(2, 9, 0),
      endAt: dayAt(2, 11, 30),
      venue: 'Campus Quad',
      category: 'Meetup',
      tags: ['sustainability', 'community'],
      status: 'scheduled',
      expectedAttendance: 45,
    },
    {
      title: 'CodeCraft TypeScript & API Design Clinic',
      description: 'Building resilient REST APIs and schema validation patterns.',
      clubId: clubByName.get('CodeCraft')._id,
      startAt: dayAt(4, 14, 0),
      endAt: dayAt(4, 16, 30),
      venue: 'Innovation Lab',
      category: 'Workshop',
      tags: ['software', 'web'],
      status: 'scheduled',
      expectedAttendance: 60,
    },
    {
      title: 'RoboKriti Drone Soldering & ESC Lab',
      description: 'Quadcopter frame assembly and flight controller flashing.',
      clubId: clubByName.get('RoboKriti')._id,
      startAt: dayAt(4, 17, 0),
      endAt: dayAt(4, 19, 0),
      venue: 'Innovation Lab',
      category: 'Workshop',
      tags: ['robotics', 'hardware'],
      status: 'scheduled',
      expectedAttendance: 40,
    },
    {
      title: 'FitFam Evening Mobility & Breathwork',
      description: 'De-stress stretch and guided recovery session after mid-week labs.',
      clubId: clubByName.get('FitFam')._id,
      startAt: dayAt(5, 17, 30),
      endAt: dayAt(5, 19, 0),
      venue: 'Campus Quad',
      category: 'Wellness',
      tags: ['wellness', 'community'],
      status: 'scheduled',
      expectedAttendance: 50,
    },
    {
      title: 'Shutterbug Lightroom Color Grading Session',
      description: 'RAW workflow and consistent visual toning for campus event albums.',
      clubId: clubByName.get('Shutterbug')._id,
      startAt: dayAt(5, 14, 0),
      endAt: dayAt(5, 16, 0),
      venue: 'Seminar Hall B',
      category: 'Workshop',
      tags: ['photography', 'visual-arts'],
      status: 'scheduled',
      expectedAttendance: 35,
    },
    {
      title: 'Debate Circle Policy Roundtable: Green Tech',
      description: 'Moderated campus policy debate featuring student researchers.',
      clubId: clubByName.get('Debate Circle')._id,
      startAt: dayAt(6, 15, 0),
      endAt: dayAt(6, 17, 0),
      venue: 'Seminar Hall A',
      category: 'Seminar',
      tags: ['policy', 'climate'],
      status: 'scheduled',
      expectedAttendance: 55,
    },
    {
      title: 'Rhythmix Jam & Songwriting Circle',
      description: 'Collaborative chord progression and lyric writing meetup.',
      clubId: clubByName.get('Rhythmix')._id,
      startAt: dayAt(7, 16, 0),
      endAt: dayAt(7, 18, 0),
      venue: 'Seminar Hall C',
      category: 'Meetup',
      tags: ['music', 'cultural'],
      status: 'scheduled',
      expectedAttendance: 30,
    },
    {
      title: 'GreenHands Zero-Waste Pop-Up Swap',
      description: 'Student book, stationery, and dorm essentials swap fair.',
      clubId: clubByName.get('GreenHands')._id,
      startAt: dayAt(7, 10, 0),
      endAt: dayAt(7, 14, 0),
      venue: 'Campus Quad',
      category: 'Meetup',
      tags: ['sustainability', 'outdoors'],
      status: 'scheduled',
      expectedAttendance: 95,
    },
    {
      title: 'Nritya Street Freestyle Cypher',
      description: 'Open-circle hip-hop and popping jam for beginners and crew leads.',
      clubId: clubByName.get('Nritya')._id,
      startAt: dayAt(8, 17, 30),
      endAt: dayAt(8, 19, 30),
      venue: 'Open Air Theatre',
      category: 'Performance',
      tags: ['dance', 'cultural'],
      status: 'scheduled',
      expectedAttendance: 70,
    },
    {
      title: 'CodeCraft Open-Source Issue Bash',
      description: 'First PR walkthrough and live mentorship on campus repositories.',
      clubId: clubByName.get('CodeCraft')._id,
      startAt: dayAt(9, 14, 0),
      endAt: dayAt(9, 17, 0),
      venue: 'Innovation Lab',
      category: 'Hackathon',
      tags: ['software', 'web'],
      status: 'scheduled',
      expectedAttendance: 55,
    },
    {
      title: 'LitSoc Zine Layout & Editorial Night',
      description: 'Final copy-editing and print layout assembly for Autumn Issue #4.',
      clubId: clubByName.get('LitSoc')._id,
      startAt: dayAt(9, 17, 30),
      endAt: dayAt(9, 19, 30),
      venue: 'Seminar Hall B',
      category: 'Meetup',
      tags: ['writing', 'storytelling'],
      status: 'scheduled',
      expectedAttendance: 22,
    },
    {
      title: 'FitFam Weekend Calisthenics Clinic',
      description: 'Bodyweight progression fundamentals for beginners.',
      clubId: clubByName.get('FitFam')._id,
      startAt: dayAt(10, 7, 0),
      endAt: dayAt(10, 8, 30),
      venue: 'Campus Quad',
      category: 'Wellness',
      tags: ['wellness', 'sports'],
      status: 'scheduled',
      expectedAttendance: 48,
    },
    {
      title: 'RoboKriti Mini-Sumo Arena Trials',
      description: 'Weight-class inspection and qualifying bouts on the dojo ring.',
      clubId: clubByName.get('RoboKriti')._id,
      startAt: dayAt(11, 14, 0),
      endAt: dayAt(11, 17, 30),
      venue: 'Main Auditorium',
      category: 'Tournament',
      tags: ['robotics', 'hardware'],
      status: 'scheduled',
      expectedAttendance: 120,
    },
    {
      title: 'Debate Circle Freshman Oratory Cup',
      description: 'Elimination rounds for first-year speakers.',
      clubId: clubByName.get('Debate Circle')._id,
      startAt: dayAt(12, 15, 0),
      endAt: dayAt(12, 18, 0),
      venue: 'Seminar Hall A',
      category: 'Tournament',
      tags: ['debate', 'speaking'],
      status: 'scheduled',
      expectedAttendance: 60,
    },
    {
      title: 'Shutterbug Campus Architecture Walk',
      description: 'Exploring symmetry and brutalist geometry across academic blocks.',
      clubId: clubByName.get('Shutterbug')._id,
      startAt: dayAt(13, 16, 30),
      endAt: dayAt(13, 18, 30),
      venue: 'Campus Quad',
      category: 'Meetup',
      tags: ['photography', 'outdoors'],
      status: 'scheduled',
      expectedAttendance: 32,
    },
  ];

  const events = await Event.insertMany(eventsData);
  const codeCraftHackathon = events.find((e) => e.title === 'CodeCraft 24h Hackathon Kickoff');
  const roboWorkshop = events.find((e) => e.title === 'RoboKriti Autonomous Bot Workshop');
  const ecoHackCompleted = events.find((e) => e.title === 'EcoHack Sprint 2026');

  // Seed ~20 volunteers with realistic skills and availability windows
  const tomorrowFullWindow = {
    label: 'Tomorrow Full Day (09:00–17:00)',
    startAt: dayAt(1, 9, 0),
    endAt: dayAt(1, 17, 0),
  };
  const weekEveningWindow = {
    label: 'Day+2 Evening (17:00–21:30)',
    startAt: dayAt(2, 17, 0),
    endAt: dayAt(2, 21, 30),
  };

  const volunteersData = [
    {
      name: 'Kabir Mehta',
      email: 'kabir.mehta@campus.edu',
      department: 'Visual Design',
      year: '3rd Year',
      skills: ['photography', 'editing', 'dslr', 'lighting'],
      preferredCategories: ['Hackathon', 'Workshop'],
      availability: [tomorrowFullWindow, weekEveningWindow],
      clubIds: [clubByName.get('Shutterbug')._id],
      assignedEventIds: [],
    },
    {
      // OVERLOADED volunteer: same skills as Kabir, available tomorrow, BUT already assigned to RoboKriti Workshop at 10:00!
      name: 'Ananya Rao',
      email: 'ananya.rao@campus.edu',
      department: 'Electronics & Comm',
      year: '3rd Year',
      skills: ['photography', 'editing', 'dslr', 'robotics'],
      preferredCategories: ['Workshop', 'Hackathon'],
      availability: [tomorrowFullWindow],
      clubIds: [clubByName.get('Shutterbug')._id, clubByName.get('RoboKriti')._id],
      assignedEventIds: [roboWorkshop._id],
    },
    {
      name: 'Ishaan Verma',
      email: 'ishaan.verma@campus.edu',
      department: 'Computer Science',
      year: '2nd Year',
      skills: ['coordination', 'check-in', 'communication', 'logistics'],
      preferredCategories: ['Hackathon', 'Seminar'],
      availability: [tomorrowFullWindow, weekEveningWindow],
      clubIds: [clubByName.get('CodeCraft')._id],
      assignedEventIds: [],
    },
    {
      name: 'Nisha Krishnan',
      email: 'nisha.krishnan@campus.edu',
      department: 'Information Science',
      year: '2nd Year',
      skills: ['coordination', 'check-in', 'hospitality'],
      preferredCategories: ['Hackathon'],
      availability: [weekEveningWindow], // Not free tomorrow 10:00!
      clubIds: [clubByName.get('GreenHands')._id],
      assignedEventIds: [],
    },
    {
      name: 'Raghavendra Pai',
      email: 'raghav.pai@campus.edu',
      department: 'Mechanical Engg',
      year: '4th Year',
      skills: ['hardware', 'robotics', 'soldering', 'logistics'],
      preferredCategories: ['Workshop', 'Tournament'],
      availability: [tomorrowFullWindow],
      clubIds: [clubByName.get('RoboKriti')._id],
      assignedEventIds: [],
    },
    {
      name: 'Zoya Khan',
      email: 'zoya.khan@campus.edu',
      department: 'Media Studies',
      year: '2nd Year',
      skills: ['photography', 'social-media', 'writing'],
      preferredCategories: ['Showcase', 'Concert'],
      availability: [weekEveningWindow],
      clubIds: [clubByName.get('Shutterbug')._id],
      assignedEventIds: [],
    },
    {
      name: 'Vivaan Gupta',
      email: 'vivaan.gupta@campus.edu',
      department: 'Computer Science',
      year: '3rd Year',
      skills: ['audio', 'stage-management', 'communication'],
      preferredCategories: ['Concert', 'Performance'],
      availability: [weekEveningWindow],
      clubIds: [clubByName.get('Rhythmix')._id],
      assignedEventIds: [],
    },
    {
      name: 'Sneha Nambiar',
      email: 'sneha.nambiar@campus.edu',
      department: 'Biotechnology',
      year: '2nd Year',
      skills: ['check-in', 'first-aid', 'outdoors'],
      preferredCategories: ['Wellness', 'Meetup'],
      availability: [tomorrowFullWindow],
      clubIds: [clubByName.get('FitFam')._id],
      assignedEventIds: [],
    },
    {
      name: 'Aditya Deshpande',
      email: 'aditya.d@campus.edu',
      department: 'Computer Science',
      year: '4th Year',
      skills: ['mentoring', 'react', 'javascript', 'ai'],
      preferredCategories: ['Hackathon'],
      availability: [tomorrowFullWindow],
      clubIds: [clubByName.get('CodeCraft')._id],
      assignedEventIds: [],
    },
    {
      name: 'Tanvi Bhatia',
      email: 'tanvi.bhatia@campus.edu',
      department: 'Architecture',
      year: '3rd Year',
      skills: ['stage-design', 'lighting', 'decor', 'editing'],
      preferredCategories: ['Performance', 'Showcase'],
      availability: [weekEveningWindow],
      clubIds: [clubByName.get('Nritya')._id],
      assignedEventIds: [],
    },
    {
      name: 'Manav Sethi',
      email: 'manav.sethi@campus.edu',
      department: 'Electrical Engg',
      year: '3rd Year',
      skills: ['audio', 'lighting', 'electronics'],
      preferredCategories: ['Concert', 'Tournament'],
      availability: [tomorrowFullWindow, weekEveningWindow],
      clubIds: [clubByName.get('Rhythmix')._id],
      assignedEventIds: [],
    },
    {
      name: 'Ira Sengupta',
      email: 'ira.sengupta@campus.edu',
      department: 'Economics',
      year: '2nd Year',
      skills: ['moderation', 'communication', 'writing'],
      preferredCategories: ['Seminar', 'Tournament'],
      availability: [tomorrowFullWindow],
      clubIds: [clubByName.get('Debate Circle')._id],
      assignedEventIds: [],
    },
    {
      name: 'Devansh Trivedi',
      email: 'devansh.t@campus.edu',
      department: 'Physics',
      year: '3rd Year',
      skills: ['optics', 'astronomy', 'outdoors', 'coordination'],
      preferredCategories: ['Stargazing', 'Workshop'],
      availability: [weekEveningWindow],
      clubIds: [clubByName.get('AstroClub')._id],
      assignedEventIds: [],
    },
    {
      name: 'kriti Agarwal',
      email: 'kriti.agarwal@campus.edu',
      department: 'Environmental Engg',
      year: '2nd Year',
      skills: ['sustainability', 'logistics', 'outdoors'],
      preferredCategories: ['Meetup', 'Wellness'],
      availability: [tomorrowFullWindow],
      clubIds: [clubByName.get('GreenHands')._id],
      assignedEventIds: [],
    },
    {
      name: 'Omkar Patil',
      email: 'omkar.patil@campus.edu',
      department: 'Computer Science',
      year: '1st Year',
      skills: ['check-in', 'logistics', 'web'],
      preferredCategories: ['Hackathon'],
      availability: [tomorrowFullWindow],
      clubIds: [clubByName.get('CodeCraft')._id],
      assignedEventIds: [],
    },
    {
      name: 'Suhana Roy',
      email: 'suhana.roy@campus.edu',
      department: 'Literature',
      year: '3rd Year',
      skills: ['writing', 'anchoring', 'communication'],
      preferredCategories: ['Performance', 'Meetup'],
      availability: [weekEveningWindow],
      clubIds: [clubByName.get('LitSoc')._id],
      assignedEventIds: [],
    },
    {
      name: 'Harshil Shah',
      email: 'harshil.shah@campus.edu',
      department: 'Mechanical Engg',
      year: '2nd Year',
      skills: ['robotics', 'cad', '3d-printing'],
      preferredCategories: ['Workshop'],
      availability: [tomorrowFullWindow],
      clubIds: [clubByName.get('RoboKriti')._id],
      assignedEventIds: [],
    },
    {
      name: 'Avni Menon',
      email: 'avni.menon@campus.edu',
      department: 'Civil Engg',
      year: '3rd Year',
      skills: ['first-aid', 'coordination', 'sports'],
      preferredCategories: ['Wellness', 'Tournament'],
      availability: [tomorrowFullWindow],
      clubIds: [clubByName.get('FitFam')._id],
      assignedEventIds: [],
    },
    {
      name: 'Reyansh Dubey',
      email: 'reyansh.dubey@campus.edu',
      department: 'Visual Design',
      year: '2nd Year',
      skills: ['dslr', 'videography', 'editing'],
      preferredCategories: ['Showcase', 'Concert'],
      availability: [weekEveningWindow],
      clubIds: [clubByName.get('Shutterbug')._id],
      assignedEventIds: [],
    },
    {
      name: 'Myra Bedi',
      email: 'myra.bedi@campus.edu',
      department: 'Information Science',
      year: '4th Year',
      skills: ['mentoring', 'communication', 'ai'],
      preferredCategories: ['Hackathon', 'Seminar'],
      availability: [tomorrowFullWindow, weekEveningWindow],
      clubIds: [clubByName.get('CodeCraft')._id],
      assignedEventIds: [],
    },
  ];

  // Fix capitalization on Kriti
  volunteersData[13].name = 'Kriti Agarwal';
  await Volunteer.insertMany(volunteersData);

  // Seed 48 realistic EventParticipant rows for EcoHack Sprint 2026 (completed event)
  const participantRows = [];
  const preTeams = ['SolarGrid', 'ByteLeaf', 'ZeroWasteAI', 'GreenPulse', 'EcoRoute', 'AquaSense'];
  const autoTeams = ['Auto-Team: CleanCampus', 'Auto-Team: WattWatch', 'Auto-Team: BioSort'];

  const firstNames = [
    'Aarav', 'Diya', 'Rohan', 'Meera', 'Siddharth', 'Tara', 'Vikram', 'Karan',
    'Neha', 'Aditi', 'Pranav', 'Riya', 'Arjun', 'Sanya', 'Devika', 'Harsh',
    'Nandini', 'Mihir', 'Vikrant', 'Pooja', 'Kabir', 'Ananya', 'Ishaan', 'Nisha',
  ];
  const lastNames = ['Sharma', 'Nair', 'Patel', 'Reddy', 'Iyer', 'Kulkarni', 'Verma', 'Joshi'];
  const depts = ['Computer Science', 'Electronics', 'Mechanical', 'Information Science', 'Biotech'];
  const years = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

  // 24 pre-formed team members (6 teams x 4)
  let idx = 0;
  for (const tName of preTeams) {
    for (let m = 0; m < 4; m++) {
      const fn = firstNames[idx % firstNames.length];
      const ln = lastNames[(idx + m) % lastNames.length];
      const attended = idx % 7 !== 0; // ~85% attendance
      participantRows.push({
        eventId: ecoHackCompleted._id,
        participantName: `${fn} ${ln}`,
        participantEmail: `${fn.toLowerCase()}.${ln.toLowerCase()}${idx}@campus.edu`,
        department: depts[idx % depts.length],
        year: years[idx % years.length],
        registrationType: 'pre',
        teamName: tName,
        attended,
        attendedAt: attended ? dayAt(-5, 9, 15 + (idx % 30)) : null,
      });
      idx++;
    }
  }

  // 12 auto-matched team members (3 teams x 4)
  for (const tName of autoTeams) {
    for (let m = 0; m < 4; m++) {
      const fn = firstNames[idx % firstNames.length];
      const ln = lastNames[(idx + 3) % lastNames.length];
      const attended = idx % 5 !== 0; // 80% attendance
      participantRows.push({
        eventId: ecoHackCompleted._id,
        participantName: `${fn} ${ln}`,
        participantEmail: `${fn.toLowerCase()}.${ln.toLowerCase()}${idx}@campus.edu`,
        department: depts[idx % depts.length],
        year: years[idx % years.length],
        registrationType: 'auto',
        teamName: tName,
        attended,
        attendedAt: attended ? dayAt(-5, 9, 20 + (idx % 25)) : null,
      });
      idx++;
    }
  }

  // 12 solo registrants
  for (let s = 0; s < 12; s++) {
    const fn = firstNames[(idx + s) % firstNames.length];
    const ln = lastNames[(idx + s + 1) % lastNames.length];
    const attended = s < 9; // 9/12 attended
    participantRows.push({
      eventId: ecoHackCompleted._id,
      participantName: `${fn} ${ln}`,
      participantEmail: `solo.${fn.toLowerCase()}${idx + s}@campus.edu`,
      department: depts[(idx + s) % depts.length],
      year: years[(idx + s) % years.length],
      registrationType: 'solo',
      teamName: null,
      attended,
      attendedAt: attended ? dayAt(-5, 9, 30 + s) : null,
    });
  }

  await EventParticipant.insertMany(participantRows);

  let agentOutput = null;
  if (runAgent) {
    agentOutput = await runAgentCycle();
  }

  return {
    clubs: clubs.length,
    events: events.length,
    volunteers: volunteersData.length,
    participants: participantRows.length,
    codeCraftHackathonId: String(codeCraftHackathon._id),
    completedEventId: String(ecoHackCompleted._id),
    agentSummary: agentOutput?.summary || null,
  };
}

// Allow running directly from CLI: `node seed/seedDemoData.js`
const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(currentFile)) {
  dbConnect()
    .then(() => seedDatabase({ runAgent: true }))
    .then((summary) => {
      console.log('[Seed] Demo database populated:', JSON.stringify(summary, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Seed] Failed:', err);
      process.exit(1);
    });
}
