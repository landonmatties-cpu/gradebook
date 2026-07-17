/*
 * bc-curriculum.js — templates for the core BC middle-school subjects.
 *
 * Each template pre-fills a class with the subject's BC curricular
 * competencies so a teacher can start assessing immediately. Everything a
 * template creates is fully editable afterward (add/remove/rename), so this
 * is a convenience, not a constraint.
 *
 * Curricular competencies below are drawn from the BC curriculum (Grades 6-8).
 * They are stable across those grades; grade-specific content/"big ideas" are
 * left to the teacher to add per class.
 */
(function (root) {
  'use strict';

  function comp(name, area) {
    return { name: name, area: area || '' };
  }

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
    },
    {
      id: 'math',
      name: 'Mathematics',
      competencies: [
        comp('Use reasoning and logic to explore, analyze, and apply mathematical ideas', 'Reasoning & Analyzing'),
        comp('Estimate reasonably', 'Reasoning & Analyzing'),
        comp('Develop, demonstrate, and apply mathematical understanding through play, inquiry, and problem solving', 'Understanding & Solving'),
        comp('Visualize to explore mathematical concepts', 'Understanding & Solving'),
        comp('Apply flexible and strategic approaches to solve problems', 'Understanding & Solving'),
        comp('Explain and justify mathematical ideas and decisions', 'Communicating & Representing'),
        comp('Communicate mathematical thinking in many ways', 'Communicating & Representing'),
        comp('Represent mathematical ideas in concrete, pictorial, and symbolic forms', 'Communicating & Representing'),
        comp('Reflect on mathematical thinking and connect concepts to other areas and personal interests', 'Connecting & Reflecting')
      ]
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
      ]
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
      ]
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

  var api = {
    SUBJECT_TEMPLATES: SUBJECT_TEMPLATES,
    DEFAULT_CATEGORIES: DEFAULT_CATEGORIES
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.BCCurriculum = api;
})(typeof window !== 'undefined' ? window : globalThis);
