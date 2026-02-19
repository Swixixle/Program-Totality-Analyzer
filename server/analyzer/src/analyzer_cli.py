import typer
import os
import json
import asyncio
from typing import Optional
from enum import Enum

from .analyzer import Analyzer
from .pta_diff import diff_packs, save_diff
from .core.adapter import load_evidence_pack
from .core.render import render_report, save_report

app = typer.Typer(
    help="Repository Reconnaissance - Generate static-artifact-anchored technical dossiers for software projects.",
    add_completion=False,
)


class RenderMode(str, Enum):
    engineer = "engineer"
    auditor = "auditor"
    executive = "executive"


@app.callback(invoke_without_command=True)
def main(ctx: typer.Context):
    """Repository Reconnaissance CLI."""
    if ctx.invoked_subcommand is None:
        typer.echo(ctx.get_help())
        raise typer.Exit(0)


@app.command("analyze")
def analyze(
    target: Optional[str] = typer.Argument(None, help="GitHub URL or local path to analyze"),
    output_dir: str = typer.Option(..., "--output-dir", "-o", help="Directory to write output files"),
    replit: bool = typer.Option(False, "--replit", help="Analyze current Replit workspace"),
    root: Optional[str] = typer.Option(None, "--root", help="Subdirectory within target to scope analysis"),
    no_llm: bool = typer.Option(False, "--no-llm", help="Deterministic mode: skip LLM calls, produce only profiler/indexer outputs"),
    mode: RenderMode = typer.Option(RenderMode.engineer, "--mode", help="Report rendering mode: engineer, auditor, or executive"),
):
    """
    Analyze a software project and generate a dossier.

    Supports three modes:
    - GitHub repo: analyze https://github.com/user/repo -o ./out
    - Local folder: analyze ./some-folder -o ./out
    - Replit workspace: analyze --replit -o ./out

    Use --no-llm for deterministic extraction without LLM dependency.
    Use --mode to select report rendering: engineer (default), auditor, or executive.
    """
    console = Analyzer.get_console()

    if replit:
        input_mode = "replit"
        source = os.getcwd()
        console.print(f"[bold green]Replit mode:[/bold green] Analyzing current workspace at {source}")
    elif target and (target.startswith("http://") or target.startswith("https://") or target.startswith("git@")):
        input_mode = "github"
        source = target
        console.print(f"[bold green]GitHub mode:[/bold green] Analyzing {source}")
    elif target and os.path.isdir(target):
        input_mode = "local"
        source = os.path.abspath(target)
        console.print(f"[bold green]Local mode:[/bold green] Analyzing {source}")
    else:
        console.print("[bold red]Error:[/bold red] Provide a GitHub URL, local path, or use --replit")
        raise typer.Exit(code=1)

    if no_llm:
        console.print("[bold yellow]--no-llm mode:[/bold yellow] Skipping LLM calls, deterministic outputs only")

    console.print(f"[bold cyan]Render mode:[/bold cyan] {mode.value}")

    try:
        analyzer = Analyzer(source, output_dir, mode=input_mode, root=root, no_llm=no_llm, render_mode=mode.value)
        asyncio.run(analyzer.run())
        console.print(f"[bold green]Analysis complete![/bold green] Results in {output_dir}")
    except Exception as e:
        console.print(f"[bold red]Error during analysis:[/bold red] {str(e)}")
        import traceback
        traceback.print_exc()
        raise typer.Exit(code=1)


@app.command("diff")
def diff(
    pack_a: str = typer.Argument(..., help="Path to first evidence_pack.v1.json"),
    pack_b: str = typer.Argument(..., help="Path to second evidence_pack.v1.json"),
    output_dir: str = typer.Option(".", "--output-dir", "-o", help="Directory to write diff output files"),
):
    """
    Compare two EvidencePack v1 files and produce a deterministic diff.

    Outputs:
    - diff.json (machine-readable)
    - DIFF_REPORT.md (human-readable)

    Example:
        rr diff out/run1/evidence_pack.v1.json out/run2/evidence_pack.v1.json -o ./diff_out
    """
    console = Analyzer.get_console()

    from pathlib import Path

    path_a = Path(pack_a)
    path_b = Path(pack_b)
    out = Path(output_dir)

    if not path_a.exists():
        console.print(f"[bold red]Error:[/bold red] Pack A not found: {pack_a}")
        raise typer.Exit(code=1)
    if not path_b.exists():
        console.print(f"[bold red]Error:[/bold red] Pack B not found: {pack_b}")
        raise typer.Exit(code=1)

    out.mkdir(parents=True, exist_ok=True)

    console.print(f"[bold]Loading packs...[/bold]")
    a = load_evidence_pack(path_a)
    b = load_evidence_pack(path_b)

    console.print(f"[bold]Computing diff...[/bold]")
    result = diff_packs(a, b)

    diff_json_path, diff_report_path = save_diff(result, out)
    console.print(f"[bold green]Diff complete![/bold green]")
    console.print(f"  diff.json: {diff_json_path}")
    console.print(f"  DIFF_REPORT.md: {diff_report_path}")

    dci = result.get("dci_delta", {})
    rci = result.get("rci_delta", {})
    console.print(f"  DCI_v1_claim_visibility: {dci.get('old_score', 0):.2%} -> {dci.get('new_score', 0):.2%} ({dci.get('direction', '?')})")
    console.print(f"  RCI_reporting_completeness: {rci.get('old_score', 0):.2%} -> {rci.get('new_score', 0):.2%} ({rci.get('direction', '?')})")


@app.command("render")
def render(
    pack_path: str = typer.Argument(..., help="Path to evidence_pack.v1.json"),
    output_dir: str = typer.Option(".", "--output-dir", "-o", help="Directory to write rendered report"),
    mode: RenderMode = typer.Option(RenderMode.engineer, "--mode", help="Report rendering mode"),
):
    """
    Re-render a report from an existing EvidencePack without re-running analysis.

    Example:
        rr render out/evidence_pack.v1.json --mode auditor -o ./reports
    """
    console = Analyzer.get_console()
    from pathlib import Path

    path = Path(pack_path)
    out = Path(output_dir)

    if not path.exists():
        console.print(f"[bold red]Error:[/bold red] Pack not found: {pack_path}")
        raise typer.Exit(code=1)

    out.mkdir(parents=True, exist_ok=True)

    pack = load_evidence_pack(path)
    content = render_report(pack, mode=mode.value)
    report_path = save_report(content, out, mode.value)
    console.print(f"[bold green]Report rendered![/bold green] {report_path}")


if __name__ == "__main__":
    app()
