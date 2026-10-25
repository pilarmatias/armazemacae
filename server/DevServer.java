import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.InvalidPathException;
import java.nio.file.Path;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.concurrent.Executors;

/** Servidor local sem dependências. Execute da raiz: java server/DevServer.java */
public class DevServer {
    private static final Map<String, String> CONTENT_TYPES = Map.of(
        "html", "text/html; charset=utf-8",
        "css", "text/css; charset=utf-8",
        "js", "text/javascript; charset=utf-8",
        "json", "application/json; charset=utf-8",
        "svg", "image/svg+xml",
        "png", "image/png",
        "jpg", "image/jpeg",
        "ico", "image/x-icon"
    );

    public static void main(String[] args) {
        try {
            Path publicPath = Path.of("public");
            if (!Files.isDirectory(publicPath)) {
                throw new IOException("A pasta public não existe. Execute da raiz do projeto.");
            }
            Path publicDirectory = publicPath.toRealPath();
            String host = System.getenv().getOrDefault("HOST", "127.0.0.1");
            int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "3001"));
            if (port < 0 || port > 65535) {
                throw new IllegalArgumentException("PORT deve estar entre 0 e 65535.");
            }
            HttpServer server = HttpServer.create(new InetSocketAddress(host, port), 0);
            var executor = Executors.newVirtualThreadPerTaskExecutor();
            server.setExecutor(executor);
            server.createContext("/", exchange -> handle(exchange, publicDirectory));
            Runtime.getRuntime().addShutdownHook(new Thread(() -> {
                server.stop(0);
                executor.close();
            }));
            server.start();
            String displayHost = host.contains(":") ? "[" + host + "]" : host;
            System.out.println("Armazém Acaé: http://" + displayHost + ":" + server.getAddress().getPort());
        } catch (Exception error) {
            System.err.println("Não foi possível iniciar o servidor: " + error.getMessage());
            System.exit(1);
        }
    }

    private static void handle(HttpExchange exchange, Path publicDirectory) throws IOException {
        try (exchange) {
            String method = exchange.getRequestMethod();
            if (!method.equals("GET") && !method.equals("HEAD")) {
                exchange.getResponseHeaders().set("Allow", "GET, HEAD");
                respond(exchange, 405, "text/plain; charset=utf-8", "Método não permitido.");
                return;
            }
            String requestedPath;
            try {
                // URLDecoder treats '+' as a space, but URL paths use a literal '+'.
                requestedPath = URLDecoder.decode(
                    exchange.getRequestURI().getRawPath().replace("+", "%2B"), StandardCharsets.UTF_8);
            } catch (IllegalArgumentException error) {
                respond(exchange, 400, "text/plain; charset=utf-8", "Caminho inválido.");
                return;
            }
            if (requestedPath.indexOf('\0') >= 0 || requestedPath.indexOf('\\') >= 0) {
                respond(exchange, 400, "text/plain; charset=utf-8", "Caminho inválido.");
                return;
            }
            for (String segment : requestedPath.split("/")) {
                if (segment.startsWith(".")) {
                    respond(exchange, 404, "text/plain; charset=utf-8", "Arquivo não encontrado.");
                    return;
                }
            }
            if (requestedPath.equals("/api/health")) {
                respond(exchange, 200, "application/json; charset=utf-8",
                    "{\"status\":\"ok\",\"project\":\"armazemacae\",\"runtime\":\"java\"}");
                return;
            }
            if (requestedPath.length() > 1 && requestedPath.endsWith("/")) {
                respond(exchange, 404, "text/plain; charset=utf-8", "Arquivo não encontrado.");
                return;
            }
            Path target;
            try {
                target = publicDirectory.resolve(requestedPath.equals("/")
                    ? "index.html" : requestedPath.substring(1)).normalize();
            } catch (InvalidPathException error) {
                respond(exchange, 400, "text/plain; charset=utf-8", "Caminho inválido.");
                return;
            }
            if (!target.startsWith(publicDirectory)) {
                respond(exchange, 404, "text/plain; charset=utf-8", "Arquivo não encontrado.");
                return;
            }
            if (!Files.exists(target)) {
                respond(exchange, 404, "text/plain; charset=utf-8", "Arquivo não encontrado.");
                return;
            }
            Path realTarget = target.toRealPath();
            if (!realTarget.startsWith(publicDirectory)) {
                respond(exchange, 404, "text/plain; charset=utf-8", "Arquivo não encontrado.");
                return;
            }
            if (!Files.isRegularFile(realTarget)) {
                respond(exchange, 404, "text/plain; charset=utf-8", "Arquivo não encontrado.");
                return;
            }
            String filename = target.getFileName().toString();
            String extension = filename.substring(filename.lastIndexOf('.') + 1).toLowerCase(java.util.Locale.ROOT);
            String contentType = CONTENT_TYPES.getOrDefault(extension, "application/octet-stream");
            Instant modified = Files.getLastModifiedTime(realTarget).toInstant().truncatedTo(ChronoUnit.SECONDS);
            String lastModified = DateTimeFormatter.RFC_1123_DATE_TIME.format(modified.atZone(ZoneOffset.UTC));
            String ifModifiedSince = exchange.getRequestHeaders().getFirst("If-Modified-Since");
            if (ifModifiedSince != null) {
                try {
                    Instant since = ZonedDateTime.parse(ifModifiedSince, DateTimeFormatter.RFC_1123_DATE_TIME).toInstant();
                    if (!modified.isAfter(since)) {
                        respond(exchange, 304, contentType, new byte[0], Map.of(
                            "Cache-Control", "no-cache",
                            "Last-Modified", lastModified
                        ));
                        return;
                    }
                } catch (DateTimeParseException ignored) {
                    // Invalid conditional headers are ignored.
                }
            }
            byte[] body = Files.readAllBytes(realTarget);
            respond(exchange, 200, contentType, body, Map.of(
                "Cache-Control", "no-cache",
                "Last-Modified", lastModified
            ));
        } catch (IOException error) {
            // The client may disconnect while a local file is being sent.
            System.err.println("Falha ao atender requisição: " + error.getMessage());
        }
    }

    private static void respond(HttpExchange exchange, int status, String contentType, String body) throws IOException {
        respond(exchange, status, contentType, body.getBytes(StandardCharsets.UTF_8));
    }

    private static void respond(HttpExchange exchange, int status, String contentType, byte[] body) throws IOException {
        respond(exchange, status, contentType, body, Map.of());
    }

    private static void respond(
        HttpExchange exchange, int status, String contentType, byte[] body, Map<String, String> headers
    ) throws IOException {
        exchange.getResponseHeaders().set("Content-Type", contentType);
        exchange.getResponseHeaders().set("X-Content-Type-Options", "nosniff");
        exchange.getResponseHeaders().set("Cache-Control", "no-store");
        headers.forEach((name, value) -> exchange.getResponseHeaders().set(name, value));
        if (status == 304) {
            exchange.sendResponseHeaders(status, -1);
            return;
        }
        if (exchange.getRequestMethod().equals("HEAD")) {
            exchange.getResponseHeaders().set("Content-Length", Integer.toString(body.length));
            exchange.sendResponseHeaders(status, -1);
        } else {
            exchange.sendResponseHeaders(status, body.length);
            exchange.getResponseBody().write(body);
        }
    }
}
