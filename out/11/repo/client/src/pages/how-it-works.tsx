import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function HowItWorks() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-8 text-muted-foreground">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Library
          </Button>
        </Link>

        <header className="mb-12 border-b border-border pb-8">
          <h1 className="text-2xl font-bold tracking-tight mb-2">How Lantern Works</h1>
          <p className="text-muted-foreground text-sm">
            Reference documentation for the evidentiary record system.
          </p>
        </header>

        <article className="prose prose-neutral dark:prose-invert prose-sm max-w-none space-y-12">
          
          <section>
            <h2 className="text-lg font-semibold border-b border-border/50 pb-2 mb-4">
              1. What Lantern Is (and Is Not)
            </h2>
            <ul className="space-y-2 text-sm text-muted-foreground list-none pl-0">
              <li>Lantern records claims and evidence.</li>
              <li>Lantern applies bounded heuristics to structured data.</li>
              <li>Lantern does not determine truth, intent, or guilt.</li>
              <li>Lantern may refuse analysis when evidence is insufficient.</li>
              <li>Lantern outputs require interpretation under scrutiny.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold border-b border-border/50 pb-2 mb-4">
              2. Core Concepts
            </h2>
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="font-medium text-foreground">Extract Pack</dt>
                <dd className="text-muted-foreground mt-1">
                  A machine-generated artifact containing entities, quotes, metrics, and timeline events extracted from source text.
                  Schema: <code className="text-xs bg-muted px-1 py-0.5 rounded">lantern.extract.pack.v1</code>
                </dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Dossier</dt>
                <dd className="text-muted-foreground mt-1">
                  A curated pack containing entities, edges (relationships), claims, and linked evidence.
                  Schema version: <code className="text-xs bg-muted px-1 py-0.5 rounded">2</code>
                </dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Entity</dt>
                <dd className="text-muted-foreground mt-1">
                  A named actor or object: person, organization, role, asset, publication, or event.
                </dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Claim</dt>
                <dd className="text-muted-foreground mt-1">
                  A recorded assertion. Types: fact, allegation, inference, opinion.
                </dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Claim Scope</dt>
                <dd className="text-muted-foreground mt-1">
                  <strong>Utterance</strong>: "X said Y" — the claim is that X made this statement.<br/>
                  <strong>Content</strong>: "Y is true" — the claim is about the truth of Y itself.
                </dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Evidence</dt>
                <dd className="text-muted-foreground mt-1">
                  A linked source artifact supporting or contradicting a claim. Includes provenance metadata.
                </dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Heuristic</dt>
                <dd className="text-muted-foreground mt-1">
                  A bounded analytical rule applied to structured data. Produces conditional findings, not conclusions.
                </dd>
              </div>
            </dl>
          </section>

          <section>
            <h2 className="text-lg font-semibold border-b border-border/50 pb-2 mb-4">
              3. Heuristics (With Limits)
            </h2>
            <div className="space-y-6 text-sm">
              <div className="border-l-2 border-border pl-4">
                <h3 className="font-medium text-foreground">Influence Hubs</h3>
                <p className="text-muted-foreground mt-1">
                  <strong>Measures:</strong> Degree centrality — which entities have the most relationship edges.
                </p>
                <p className="text-muted-foreground mt-1">
                  <strong>Does NOT imply:</strong> Importance, guilt, leadership, or causal responsibility.
                </p>
              </div>
              <div className="border-l-2 border-border pl-4">
                <h3 className="font-medium text-foreground">Funding Gravity</h3>
                <p className="text-muted-foreground mt-1">
                  <strong>Measures:</strong> Concentration and flow of monetary edges (funded_by, donated_to, grant_from, etc.).
                </p>
                <p className="text-muted-foreground mt-1">
                  <strong>Does NOT imply:</strong> Corruption, undue influence, or improper behavior.
                </p>
              </div>
              <div className="border-l-2 border-border pl-4">
                <h3 className="font-medium text-foreground">Enforcement Map</h3>
                <p className="text-muted-foreground mt-1">
                  <strong>Measures:</strong> Presence of coercive edges (censored_by, banned_by, sued_by, fired_by, etc.).
                </p>
                <p className="text-muted-foreground mt-1">
                  <strong>Does NOT imply:</strong> Wrongdoing by either party, or that actions were unjustified.
                </p>
              </div>
              <div className="border-l-2 border-border pl-4">
                <h3 className="font-medium text-foreground">Sensitivity / Robustness</h3>
                <p className="text-muted-foreground mt-1">
                  <strong>Measures:</strong> Whether findings survive removal of any single entity or edge.
                </p>
                <p className="text-muted-foreground mt-1">
                  <strong>Does NOT imply:</strong> That robust findings are correct, only that they are not single-point dependent.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold border-b border-border/50 pb-2 mb-4">
              4. Limits & Safeguards
            </h2>
            <div className="space-y-4 text-sm text-muted-foreground">
              <div>
                <strong className="text-foreground">Evidence Density Thresholds</strong>
                <p className="mt-1">Each heuristic requires a minimum count of relevant edges before analysis proceeds.</p>
              </div>
              <div>
                <strong className="text-foreground">"Insufficient Data" Gating</strong>
                <p className="mt-1">If thresholds are not met, the system displays "Insufficient Data" rather than producing weak findings.</p>
              </div>
              <div>
                <strong className="text-foreground">Migration Logs</strong>
                <p className="mt-1">When pack schemas are upgraded, all transformations are recorded in a migration log for audit.</p>
              </div>
              <div>
                <strong className="text-foreground">Sensitivity Checks</strong>
                <p className="mt-1">Findings are tested for robustness by simulating removal of each data point.</p>
              </div>
              <div>
                <strong className="text-foreground">Comparison Sufficiency Rules</strong>
                <p className="mt-1">Cross-dossier comparisons require both packs to meet density thresholds independently.</p>
              </div>
              <div>
                <strong className="text-foreground">Cryptographic Fingerprints</strong>
                <p className="mt-1">Reports and comparisons include SHA-256 hashes for tamper-evidence and audit binding.</p>
              </div>
              <div className="bg-muted/30 p-4 rounded-lg border border-border/50 mt-6">
                <p className="text-foreground font-medium">Refusal is correct behavior.</p>
                <p className="mt-1">When Lantern declines to produce analysis, it is working as designed.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold border-b border-border/50 pb-2 mb-4">
              5. Responsible Use
            </h2>
            <ul className="space-y-2 text-sm text-muted-foreground list-none pl-0">
              <li>Lantern is an evidentiary record, not an accusation engine.</li>
              <li>All outputs require interpretation under scrutiny.</li>
              <li>Findings are conditional on recorded data and applied constraints.</li>
              <li>Misuse is outside system intent and design.</li>
              <li>Users bear responsibility for conclusions drawn beyond recorded limits.</li>
            </ul>
          </section>

        </article>

        <footer className="mt-16 pt-6 border-t border-border/50 text-xs text-muted-foreground">
          <p>Lantern v1.0 — Evidentiary Record System</p>
        </footer>
      </div>
    </div>
  );
}
