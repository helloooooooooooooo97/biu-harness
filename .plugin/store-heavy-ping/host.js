// util.ts
var ping = "pong";

// host.ts
var name = "store-heavy-ping";
var inject = ["http"];
function apply(ctx) {
  ctx.http.route("GET", "/api/store-heavy-ping", (route) => {
    route.send(200, { ping, heavy: true });
  });
}
export {
  apply,
  inject,
  name
};
