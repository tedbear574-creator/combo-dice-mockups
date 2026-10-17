"""Load a mockup in headless Chromium, run it for a while, fail on any page error.

usage: python scripts/smoke.py [FILE] [--seconds N] [--eval JS]... [--shot PNG] [--size WxH] [--query QS]

--eval runs JS in the page after load (the mockup exposes window.T as its test hook);
evals run in order with --seconds split evenly between them. --shot saves a screenshot at the end.
Exit code 1 if the page logged a console error or threw.
"""

import argparse
import pathlib
import sys

from playwright.sync_api import sync_playwright


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("file", nargs="?", default="tycoon-v2.html")
    ap.add_argument("--seconds", type=float, default=6)
    ap.add_argument("--eval", action="append", default=[])
    ap.add_argument("--shot")
    ap.add_argument("--size", default="1280x800")
    ap.add_argument("--query", default="")
    a = ap.parse_args()

    url = pathlib.Path(a.file).resolve().as_uri() + (("?" + a.query) if a.query else "")
    w, h = (int(v) for v in a.size.split("x"))
    errors: list[str] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--autoplay-policy=no-user-gesture-required"])
        page = browser.new_page(viewport={"width": w, "height": h})
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        page.on("console", lambda m: m.type == "error" and errors.append(f"console: {m.text}"))
        page.goto(url)
        page.wait_for_function("window.T !== undefined", timeout=20000)
        steps = a.eval or [""]
        for js in steps:
            if js:
                out = page.evaluate(f"(async () => {{ {js} }})()")
                if out is not None:
                    print(out)
            page.wait_for_timeout(a.seconds * 1000 / len(steps))
        if a.shot:
            page.screenshot(path=a.shot)
            print("screenshot:", a.shot)
        browser.close()
    for e in errors:
        print(e)
    print("ok" if not errors else f"{len(errors)} error(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
