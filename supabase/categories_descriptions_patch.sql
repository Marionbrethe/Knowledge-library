-- Phase 5 patch: adds description column to categories and seeds meaningful default descriptions.
-- Run this in the Supabase SQL editor before using the Categories management page.

ALTER TABLE categories ADD COLUMN IF NOT EXISTS description TEXT;

-- Topic categories
UPDATE categories SET description = 'Frameworks, rubrics, and metrics for evaluating AI outputs, interview quality, and recommendation accuracy. Includes benchmark design, human evaluation protocols, and quality measurement for LLM-generated content.' WHERE name = 'Evals & measurement' AND type = 'topic';

UPDATE categories SET description = 'How enterprises adopt AI tools, manage cultural resistance, and navigate organisational transformation. Includes change management, workforce re-skilling, executive sponsorship, and the human side of AI rollout.' WHERE name = 'AI adoption & org change' AND type = 'topic';

UPDATE categories SET description = 'The core challenge of surfacing what an organisation actually does versus what it says it does. Research on bridging the gap between documented processes and real-world practice in enterprise AI discovery.' WHERE name = 'Mapping problem & discovery' AND type = 'topic';

UPDATE categories SET description = 'How expertise, intuition, and know-how that cannot easily be written down gets elicited, structured, and made machine-readable. Relevant to interview methodology and knowledge elicitation techniques.' WHERE name = 'Tacit knowledge & work capture' AND type = 'topic';

UPDATE categories SET description = 'Structured methodologies, repeatable processes, and best-practice templates for AI consulting engagements. Includes discovery frameworks, project playbooks, and delivery blueprints.' WHERE name = 'Playbook & methodology' AND type = 'topic';

UPDATE categories SET description = 'Approaches that actively involve workers and domain experts in designing AI systems that affect their roles. Includes participatory design, worker feedback loops, and ethical AI deployment.' WHERE name = 'Co-design & worker voice' AND type = 'topic';

UPDATE categories SET description = 'How proprietary data accumulates and compounds to create defensible competitive advantages. Relevant to LichenAI''s long-term strategy around interview data, outcome data, and model improvement loops.' WHERE name = 'Data flywheel & moat' AND type = 'topic';

UPDATE categories SET description = 'Retrieval-augmented generation architectures, vector search, chunking strategies, re-ranking, and hybrid search. Directly relevant to the knowledge library and interview-context retrieval features.' WHERE name = 'RAG & retrieval' AND type = 'topic';

UPDATE categories SET description = 'Practical tools, APIs, frameworks, and infrastructure for building and deploying LLM-powered applications. Includes prompt engineering, fine-tuning, model hosting, and LLMOps.' WHERE name = 'LLM tooling & infrastructure' AND type = 'topic';

UPDATE categories SET description = 'Academic papers, industry studies, and empirical evidence that underpin LichenAI''s product claims and consulting thesis. Useful for credibility-building with enterprise buyers and investors.' WHERE name = 'Research & evidence base' AND type = 'topic';

-- Use-case tags
UPDATE categories SET description = 'Content useful for pitching LichenAI to potential consulting clients — case studies, ROI frameworks, objection handlers, and positioning narratives.' WHERE name = 'Consultant pitch' AND type = 'use_case';

UPDATE categories SET description = 'Material that supports the investor story: market size, differentiation, traction evidence, and the long-term vision for AI-assisted discovery.' WHERE name = 'Investor narrative' AND type = 'use_case';

UPDATE categories SET description = 'Evidence and benchmarks that validate the quality of LichenAI''s interview outputs and recommendations. Feeds directly into the evals rubric and product credibility.' WHERE name = 'Evals evidence' AND type = 'use_case';

UPDATE categories SET description = 'Resources for getting new team members or client stakeholders up to speed quickly on LichenAI''s approach, methodology, and tools.' WHERE name = 'Onboarding' AND type = 'use_case';

UPDATE categories SET description = 'Analysis of competing products, alternative approaches, or adjacent markets. Informs positioning decisions and feature prioritisation.' WHERE name = 'Competitive intelligence' AND type = 'use_case';

UPDATE categories SET description = 'Research that directly informs a specific feature, architectural choice, or strategic direction currently under discussion by the product team.' WHERE name = 'Product decision' AND type = 'use_case';
