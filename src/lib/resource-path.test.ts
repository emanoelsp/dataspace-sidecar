import { test } from "node:test"
import assert from "node:assert/strict"
import { parseResources, upstreamPath, availableEndpoints } from "./resource-path.ts"

const RESOURCES = [
  { id: "operational", name: "Operational Data", path: "/api/v1/operational" },
  { id: "hcm-episodes", path: "/api/v1/hcm/episodes" },
]

test("data and aas keep their fixed paths", () => {
  assert.equal(upstreamPath("data", RESOURCES), "/api/data")
  assert.equal(upstreamPath("aas"), "/api/aas")
})

test("a registered resource maps to its path on the CPS", () => {
  assert.equal(upstreamPath("operational", RESOURCES), "/api/v1/operational")
  assert.equal(upstreamPath("hcm-episodes", RESOURCES), "/api/v1/hcm/episodes")
})

test("an unknown endpoint is rejected", () => {
  assert.equal(upstreamPath("cognitive", RESOURCES), null)
  assert.equal(upstreamPath("operational"), null)
})

test("lists builtin endpoints plus resources", () => {
  assert.deepEqual(availableEndpoints(RESOURCES), ["data", "aas", "operational", "hcm-episodes"])
})

test("parses valid resources and keeps only id, path and name", () => {
  assert.deepEqual(parseResources([{ id: "operational", name: "Operational Data", path: "/api/v1/operational", extra: 1 }]), [
    { id: "operational", name: "Operational Data", path: "/api/v1/operational" },
  ])
  assert.deepEqual(parseResources(undefined), [])
})

test("rejects invalid resources", () => {
  for (const bad of [
    "not-an-array",
    [{ id: "Bad Id", path: "/x" }],
    [{ id: "data", path: "/x" }],
    [{ id: "dup", path: "/a" }, { id: "dup", path: "/b" }],
    [{ id: "ok", path: "relative" }],
    [{ id: "ok", path: "/../etc/passwd" }],
    [{ id: "ok", path: "http://evil.example/x" }],
  ]) {
    assert.equal(typeof parseResources(bad), "string", JSON.stringify(bad))
  }
})
