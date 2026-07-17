/*
 * bc-curriculum.js — grade-aware templates for the core BC middle-school
 * subjects (Grades 6, 7, 8).
 *
 * Each subject provides:
 *   - competencies:  the BC *Curricular Competencies* (the standards a teacher
 *                    assesses). In the BC curriculum these are consistent
 *                    across Grades 6-8 for a given subject, so they are shared.
 *   - contentByGrade: the grade-specific *Content* learning standards (the
 *                    topics that actually change from grade to grade). These
 *                    are what make a Grade 6 class differ from a Grade 7 class.
 *
 * When a class is created for a subject + grade, it is pre-filled with that
 * subject's curricular competencies PLUS that grade's content topics, each
 * grouped by "area". Everything is fully editable afterward — this is a
 * starting point, and teachers should confirm wording against the current
 * official BC curriculum (curriculum.gov.bc.ca).
 */
(function (root) {
  'use strict';

  var GRADES = ['6', '7', '8'];

  function comp(name, area) { return { name: name, area: area || '' }; }

  var SUBJECT_TEMPLATES = [
    {
      id: 'ela',
      name: 'English Language Arts',
      competencies: [
        comp('Access and integrate information and ideas from a variety of sources', 'Comprehend & Connect'),
        comp('Apply a variety of reading, listening, and viewing strategies to comprehend texts', 'Comprehend & Connect'),
        comp('Recognize and appreciate the diversity within and across communities', 'Comprehend & Connect'),
        comp('Think critically, creatively, and reflectively to explore ideas within, between, and beyond texts', 'Comprehend & Connect'),
        comp('Respond to text in personal, creative, and critical ways', 'Comprehend & Connect'),
        comp('Use writing and design processes to plan, develop, and create texts', 'Create & Communicate'),
        comp('Assess and refine texts to improve clarity, effectiveness, and impact', 'Create & Communicate'),
        comp('Use language in creative and playful ways to develop style', 'Create & Communicate'),
        comp('Use conventions of Canadian spelling, grammar, and punctuation', 'Create & Communicate')
      ]
      // ELA curricular competencies are consistent across Grades 6-8 in the BC
      // curriculum, so no grade-specific content list is defined here.
    },
    {
      id: 'math',
      name: 'Mathematics',
      competencies: [
        comp('Use reasoning and logic to explore, analyze, and apply mathematical ideas', 'Reasoning & Analyzing'),
        comp('Estimate reasonably', 'Reasoning & Analyzing'),
        comp('Demonstrate and apply mental math strategies', 'Reasoning & Analyzing'),
        comp('Develop, demonstrate, and apply mathematical understanding through play, inquiry, and problem solving', 'Understanding & Solving'),
        comp('Visualize to explore mathematical concepts', 'Understanding & Solving'),
        comp('Apply multiple strategies to solve problems in abstract and contextualized situations', 'Understanding & Solving'),
        comp('Explain and justify mathematical ideas and decisions', 'Communicating & Representing'),
        comp('Communicate mathematical thinking in many ways', 'Communicating & Representing'),
        comp('Represent mathematical ideas in concrete, pictorial, and symbolic forms', 'Communicating & Representing'),
        comp('Reflect on mathematical thinking and connect concepts to other areas and personal interests', 'Connecting & Reflecting')
      ],
      contentByGrade: {
        '6': [
          'Whole numbers to billions and decimals to thousandths',
          'Multiplication and division of decimals',
          'Factors, multiples, greatest common factor, and least common multiple',
          'Improper fractions and mixed numbers',
          'Introduction to ratios',
          'Whole-number percents and percentage discounts',
          'Order of operations with whole numbers',
          'One-step equations and preservation of equality',
          'Perimeter of complex shapes; area of triangles, parallelograms, and trapezoids',
          'Angle measurement and classification; triangles',
          'Volume and capacity',
          'Combinations of transformations',
          'Line graphs',
          'Single-outcome probability'
        ],
        '7': [
          'Operations with integers',
          'Operations and order of operations with decimals',
          'Addition and subtraction of fractions',
          'Relationships between decimals, fractions, ratios, and percents',
          'Discrete linear relations using two variables',
          'Expressions — writing and evaluating using substitution',
          'Two-step equations with whole-number coefficients',
          'Circumference and area of circles',
          'Volume of rectangular prisms and cylinders',
          'Cartesian coordinates and graphing',
          'Combinations of transformations',
          'Circle graphs',
          'Experimental probability with two independent events',
          'Financial literacy — simple budgeting and consumer math'
        ],
        '8': [
          'Perfect squares and cubes; square and cube roots',
          'Percents less than 1 and greater than 100',
          'Numerical proportional reasoning (rates, ratio, proportions, percent)',
          'Operations with fractions (all four operations)',
          'Discrete linear relations with integers',
          'Expressions — writing and evaluating using substitution',
          'Two-variable linear relations — graphing, interpolation, and extrapolation',
          'Solving linear equations',
          'The Pythagorean theorem',
          'Surface area and volume of right prisms and cylinders',
          'Construction, views, and nets of 3D objects',
          'Central tendency',
          'Theoretical probability with two independent events',
          'Financial literacy — best buys'
        ]
      }
    },
    {
      id: 'science',
      name: 'Science',
      competencies: [
        comp('Demonstrate a sustained curiosity about the natural world; question and predict', 'Questioning & Predicting'),
        comp('Make observations and collect reliable data through experimentation', 'Planning & Conducting'),
        comp('Use appropriate tools, technologies, and materials safely', 'Planning & Conducting'),
        comp('Experience and interpret the local environment; process and analyze data', 'Processing & Analyzing'),
        comp('Identify patterns and connections in data', 'Processing & Analyzing'),
        comp('Evaluate evidence and reasoning to draw conclusions', 'Evaluating'),
        comp('Consider social, ethical, and environmental implications of findings', 'Evaluating'),
        comp('Apply and innovate; contribute to solving problems collaboratively', 'Applying & Innovating'),
        comp('Communicate ideas, findings, and solutions clearly and appropriately', 'Communicating')
      ],
      contentByGrade: {
        '6': [
          'Structures and functions of body systems (digestive, musculoskeletal, respiratory, circulatory)',
          'Sensing and responding in humans, other animals, and plants',
          'Heterogeneous and homogeneous mixtures, and separating mixtures',
          'Newton’s three laws of motion; types of forces',
          'The solar system and Earth’s place in the Milky Way galaxy',
          'First Peoples knowledge of astronomy'
        ],
        '7': [
          'Survival needs, adaptations, and natural selection',
          'Evidence of evolution and the fossil record',
          'Elements, compounds, atoms, and the periodic table',
          'Static and current electricity, magnetism, and electromagnetism',
          'Plate tectonics and the age of the Earth',
          'Climate change over geological time'
        ],
        '8': [
          'Cell theory and characteristics of living things',
          'The cell as a system; cellular processes (diffusion and osmosis)',
          'Kinetic molecular theory and the states of matter',
          'Atomic theory, models, and the relationship between atoms and molecules',
          'Properties and behaviour of light and optics (reflection and refraction)',
          'Relationships of micro-organisms with living things'
        ]
      }
    },
    {
      id: 'socials',
      name: 'Social Studies',
      competencies: [
        comp('Use Social Studies inquiry processes and skills to ask questions and gather evidence', 'Inquiry'),
        comp('Assess the significance of people, places, events, and developments', 'Significance'),
        comp('Assess the reliability and adequacy of evidence and sources', 'Evidence'),
        comp('Analyze continuity and change in different periods, places, and societies', 'Continuity & Change'),
        comp('Determine and analyze cause and consequence of events and developments', 'Cause & Consequence'),
        comp('Explain and infer different perspectives on people, places, and events', 'Perspective'),
        comp('Make reasoned ethical judgments about actions and assess appropriate ways to respond', 'Ethical Judgment')
      ],
      contentByGrade: {
        '6': [
          'Economic policies and resource management, including effects on Indigenous peoples',
          'Globalization and economic interdependence',
          'Systems of government and how they compare',
          'Roles of individuals, governmental, and non-governmental organizations',
          'Different systems of law; human rights and responses to discrimination',
          'Regional and international conflict'
        ],
        '7': [
          'Anthropological origins of humans',
          'Human responses to geographic challenges and opportunities',
          'Features of civilizations and factors in their rise and fall',
          'Interactions and exchanges between past civilizations',
          'Social, political, legal, governmental, and economic systems of ancient civilizations',
          'Origins, beliefs, and influences of religions and belief systems'
        ],
        '8': [
          'Social, political, and economic systems, including gender and class structures',
          'Scientific and technological innovations',
          'Exploration, expansion, and colonization',
          'Contacts and conflicts between peoples',
          'Changes in population and living standards',
          'Philosophical and cultural shifts (Renaissance and Reformation)'
        ]
      }
    },
    {
      id: 'phe',
      name: 'Physical & Health Education',
      competencies: [
        comp('Develop and demonstrate a variety of fundamental and complex movement skills', 'Physical Literacy'),
        comp('Apply methods of monitoring and adjusting physical exertion levels', 'Physical Literacy'),
        comp('Explain how developing competencies helps to build confidence and active living', 'Healthy & Active Living'),
        comp('Identify and describe opportunities for physical activity at school and in the community', 'Healthy & Active Living'),
        comp('Describe and assess strategies for promoting mental well-being', 'Mental Well-Being'),
        comp('Describe and assess strategies for managing problems related to health and relationships', 'Social & Community Health'),
        comp('Explore strategies for developing and maintaining healthy relationships', 'Social & Community Health')
      ]
    },
    {
      id: 'adst',
      name: 'Applied Design, Skills & Technologies',
      competencies: [
        comp('Engage in a period of user-centred research and empathetic observation', 'Applied Design'),
        comp('Generate ideas and add to others’ ideas; screen ideas against criteria and constraints', 'Applied Design'),
        comp('Prototype, test, and make changes to iteratively improve a product', 'Applied Design'),
        comp('Use appropriate tools, technologies, and materials safely and skillfully', 'Applied Skills'),
        comp('Identify and evaluate the skills and skill levels needed for a task', 'Applied Skills'),
        comp('Reflect on design thinking and share process and product with an audience', 'Applied Technologies')
      ]
    },
    {
      id: 'arts',
      name: 'Arts Education',
      competencies: [
        comp('Explore artistic possibilities and take creative risks', 'Exploring & Creating'),
        comp('Create artistic works collaboratively and independently', 'Exploring & Creating'),
        comp('Develop and refine ideas, skills, and elements to improve an artistic work', 'Reasoning & Reflecting'),
        comp('Reflect on creative processes and make connections to other experiences', 'Reasoning & Reflecting'),
        comp('Interpret and communicate ideas using symbolism and meaning in the arts', 'Communicating & Documenting'),
        comp('Receive and offer constructive feedback on artistic works', 'Communicating & Documenting')
      ]
    },
    {
      id: 'career',
      name: 'Career Education',
      competencies: [
        comp('Recognize personal strengths and connect them to future goals', 'Personal Development'),
        comp('Set and adjust realistic short- and long-term goals', 'Connections to Community'),
        comp('Explore how work contributes to community and society', 'Connections to Community'),
        comp('Develop skills for working effectively with others', 'Career-Life Development'),
        comp('Reflect on learning and experiences to inform future decisions', 'Career-Life Development')
      ]
    },
    {
      id: 'french',
      name: 'Core French',
      competencies: [
        comp('Comprehend spoken and written French in familiar contexts', 'Comprehending'),
        comp('Respond to and produce simple messages in French', 'Communicating'),
        comp('Exchange ideas and information in spoken and written French', 'Communicating'),
        comp('Recognize the relationship between language and culture', 'Connecting'),
        comp('Identify aspects of Francophone cultures and communities', 'Connecting')
      ]
    }
  ];

  // Sensible default assignment categories for a new class.
  var DEFAULT_CATEGORIES = [
    { name: 'Formative / Practice', weight: 10 },
    { name: 'Assignments', weight: 30 },
    { name: 'Quizzes', weight: 20 },
    { name: 'Projects', weight: 25 },
    { name: 'Tests', weight: 15 }
  ];

  // Build the pre-filled competency list for a subject template at a grade:
  // the shared curricular competencies plus that grade's content topics.
  function competenciesFor(tpl, grade) {
    if (!tpl) return [];
    var out = tpl.competencies.map(function (c) { return { name: c.name, area: c.area }; });
    if (tpl.contentByGrade && tpl.contentByGrade[grade]) {
      tpl.contentByGrade[grade].forEach(function (name) {
        out.push({ name: name, area: 'Grade ' + grade + ' Content' });
      });
    }
    return out;
  }

  function templateById(id) {
    return SUBJECT_TEMPLATES.filter(function (t) { return t.id === id; })[0] || null;
  }

  var api = {
    GRADES: GRADES,
    SUBJECT_TEMPLATES: SUBJECT_TEMPLATES,
    DEFAULT_CATEGORIES: DEFAULT_CATEGORIES,
    competenciesFor: competenciesFor,
    templateById: templateById
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.BCCurriculum = api;
})(typeof window !== 'undefined' ? window : globalThis);
