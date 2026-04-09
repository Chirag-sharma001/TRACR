class ReplayService {
  constructor({
    failureModel,
    ledgerModel,
    repository,
    clock = () => new Date(),
    logger = console,
  } = {}) {
    this.failureModel = failureModel;
    this.ledgerModel = ledgerModel;
    this.repository = repository;
    this.clock = clock;
    this.logger = logger;
  }

  async listFailedItems(_params) {
    throw new Error("not_implemented");
  }

  async reprocessFailedItem(_params) {
    throw new Error("not_implemented");
  }
}

module.exports = ReplayService;
