// Importing this module registers all surface pipelines (side-effect). Routes that resolve a
// pipeline by surface (advance/status/resume) import this so the registry is populated.
import "./authority-request/pipeline";
import "./fleet-onboarding/pipeline";
import "./regulation-intake/pipeline";
