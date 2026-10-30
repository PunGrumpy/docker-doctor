---
"@docker-doctor/cli": patch
---

`order-layers` no longer reports a `pip install` of the project itself after `COPY . .`, since that install cannot move above the copy. It skips `pip install .`, `pip install -e .` and `pip install ".[dev]"` when the command has `--no-deps` or when a `pip install` of the dependencies already ran earlier in the same stage, before the copy. Upgrading `pip`, `setuptools` or `wheel`, or running another tool's install such as `npm ci`, does not count as that install. A bare `pip install .` with no earlier install is still reported, and so are `pip install -r requirements.txt` and `npm install -g pnpm`, whose downloads can move above the copy.
