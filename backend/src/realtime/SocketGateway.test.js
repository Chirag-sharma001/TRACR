jest.mock("socket.io", () => {
    const ioMock = {
        on: jest.fn(),
        emit: jest.fn(),
        close: jest.fn(),
        to: jest.fn(() => ({ emit: jest.fn() })),
    };

    return {
        Server: jest.fn(() => ioMock),
        __ioMock: ioMock,
    };
});

const { EventEmitter } = require("events");
const { __ioMock } = require("socket.io");
const SocketGateway = require("./SocketGateway");

function buildSocket({
    id = "socket-1",
    origin = "http://allowed.local",
    auth = { role: "INVESTIGATOR", channel_scopes: ["GRAPH_READ"] },
} = {}) {
    return {
        id,
        handshake: {
            headers: { origin },
            auth,
        },
        data: {},
        on: jest.fn(),
        emit: jest.fn(),
        join: jest.fn(),
        leave: jest.fn(),
        disconnect: jest.fn(),
    };
}

describe("SocketGateway", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        __ioMock.emit.mockClear();
        __ioMock.on.mockClear();
        __ioMock.to.mockClear();
        __ioMock.close.mockClear();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test("emits alert:new with payload and pushes metrics every 5 seconds", async () => {
        const emitter = new EventEmitter();
        const alertModel = {
            aggregate: jest
                .fn()
                .mockResolvedValueOnce([{ _id: "HIGH", count: 2 }])
                .mockResolvedValueOnce([{ _id: { hour: "2026-01-01T01:00:00Z" }, count: 2 }]),
        };

        const gateway = new SocketGateway({
            httpServer: {},
            emitter,
            alertModel,
            sarQueue: { getDepth: () => 3 },
            logger: { error: jest.fn() },
        });

        gateway.start();

        const payload = {
            alert_id: "a1",
            edge: {
                from: "A",
                to: "B",
                amount: 2000,
                timestamp: new Date().toISOString(),
                txId: "tx-1",
            },
        };

        emitter.emit("alert:new", payload);
        expect(__ioMock.emit).toHaveBeenCalledWith("alert:new", payload);

        await jest.advanceTimersByTimeAsync(5000);

        expect(__ioMock.emit).toHaveBeenCalledWith(
            "metrics:update",
            expect.objectContaining({
                tps: expect.any(Number),
                alertCounts: expect.objectContaining({ HIGH: 2 }),
                sarQueueDepth: 3,
            })
        );

        gateway.stop();
        expect(__ioMock.close).toHaveBeenCalled();
    });

    test("rejects socket connections from unapproved origins", () => {
        const emitter = new EventEmitter();
        const gateway = new SocketGateway({
            httpServer: {},
            emitter,
            alertModel: { aggregate: jest.fn(async () => []) },
            approvedOrigins: ["http://allowed.local"],
            corsOrigin: ["http://allowed.local"],
        });

        gateway.start();
        const onConnection = __ioMock.on.mock.calls.find((call) => call[0] === "connection")[1];
        const socket = buildSocket({ origin: "http://blocked.local" });
        onConnection(socket);

        expect(socket.emit).toHaveBeenCalledWith("connection:denied", { error: "forbidden_origin" });
        expect(socket.disconnect).toHaveBeenCalledWith(true);

        gateway.stop();
    });

    test("denies graph subscription without required channel scope", () => {
        const emitter = new EventEmitter();
        const gateway = new SocketGateway({
            httpServer: {},
            emitter,
            alertModel: { aggregate: jest.fn(async () => []) },
            approvedOrigins: ["http://allowed.local"],
            corsOrigin: ["http://allowed.local"],
        });

        gateway.start();
        const onConnection = __ioMock.on.mock.calls.find((call) => call[0] === "connection")[1];
        const socket = buildSocket({ auth: { role: "INVESTIGATOR", channel_scopes: ["METRICS_READ"] } });
        onConnection(socket);

        const onSubscribe = socket.on.mock.calls.find((call) => call[0] === "graph:subscribe")[1];
        onSubscribe({ accountId: "acct-1", channel_scope: "GRAPH_READ" });

        expect(socket.emit).toHaveBeenCalledWith("graph:denied", { error: "scope_forbidden" });
        expect(socket.join).not.toHaveBeenCalled();

        gateway.stop();
    });
});
