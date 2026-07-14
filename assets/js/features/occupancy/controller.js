import { assertDateRange } from "../../domain/date-range.js";
import { normalizeOccupancyPayload } from "../../domain/occupancy.js";

export function createOccupancyController({
  api,
  cache,
  view,
  print,
  AbortController,
  onBookingDate = () => {}
}) {
  let payload = null;
  let range = null;
  let stale = false;
  let generation = 0;
  let loadingGeneration = null;
  let abortController = null;
  let started = false;
  let startPromise = null;

  function isLoading() {
    return loadingGeneration === generation;
  }

  function printSource(selection = view.readSelection()) {
    return payload && range ? { payload, range, view: selection.view, stale } : null;
  }

  function renderCurrent(selection = view.readSelection()) {
    if (!payload || !range) return false;
    view.render(payload, range, stale);
    print.update(printSource(selection));
    return true;
  }

  function commit(nextPayload, nextRange, nextStale, error = null) {
    payload = normalizeOccupancyPayload(nextPayload, nextRange);
    range = Object.freeze(assertDateRange(nextRange));
    stale = nextStale === true;
    view.render(payload, range, stale);
    view.renderMeta(payload, stale, error);
    print.update(printSource());
  }

  async function load(nextRange) {
    const requestedRange = Object.freeze(assertDateRange(nextRange));
    cache.cleanup(requestedRange);
    const requestGeneration = ++generation;
    if (abortController) abortController.abort();
    abortController = new AbortController();
    const signal = abortController.signal;
    loadingGeneration = requestGeneration;
    view.setLoading(true);
    print.setLoading(true);

    try {
      const response = await api.getOccupancy(requestedRange, { signal });
      if (requestGeneration !== generation || signal.aborted) return null;
      const normalized = normalizeOccupancyPayload(response, requestedRange);
      cache.write(requestedRange, normalized);
      commit(normalized, requestedRange, false);
      return normalized;
    } catch (error) {
      if (requestGeneration !== generation || signal.aborted || (error && error.name === "AbortError")) return null;
      const cached = cache.read(requestedRange);
      if (cached) {
        commit(cached, requestedRange, true, error);
        return cached;
      }
      payload = null;
      range = null;
      stale = false;
      print.update(null);
      view.renderError(error);
      return null;
    } finally {
      if (requestGeneration === generation) {
        abortController = null;
        loadingGeneration = null;
        view.setLoading(false);
        print.setLoading(false);
      }
    }
  }

  function refresh(selection = view.readSelection()) {
    if (isLoading()) return Promise.resolve(null);
    return load(selection.range);
  }

  function changeSelection(selection) {
    return load(selection.range);
  }

  function changeView(selection) {
    renderCurrent(selection);
  }

  function start() {
    if (started) return startPromise;
    started = true;
    print.bind();
    view.bind({
      onRefresh: refresh,
      onSelectionChange: changeSelection,
      onViewChange: changeView,
      onBookingDate
    });
    startPromise = load(view.readSelection().range);
    return startPromise;
  }

  function dispose() {
    if (!started) return;
    started = false;
    startPromise = null;
    generation += 1;
    if (abortController) abortController.abort();
    abortController = null;
    loadingGeneration = null;
    payload = null;
    range = null;
    stale = false;
    view.setLoading(false);
    print.setLoading(false);
    view.dispose();
    print.dispose();
  }

  return { start, refresh, reload: () => load(view.readSelection().range), renderCurrent, dispose };
}
