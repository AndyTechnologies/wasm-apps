#ifndef WASM_LINKER_FS_RUNTIME_H
#define WASM_LINKER_FS_RUNTIME_H

#include <string>
#include <vector>
#include <fstream>
#include <iostream>
#include <sstream>
#include <cstring>
#include <ctime>
#include <sys/stat.h>
#include <fcntl.h>
#include <unistd.h>
#include <algorithm>
#include <cstdint>
#include <array>
#include <cerrno>
#include <climits>
#include <cstdlib>

// ──────────────────────────────────────────────
// Minimal JSON helpers for permissions file
// ──────────────────────────────────────────────

namespace FsRuntime {

static std::string jsonEscape(const std::string& s) {
  std::string out;
  out.reserve(s.size() + 2);
  for (char c : s) {
    switch (c) {
      case '"': out += "\\\""; break;
      case '\\': out += "\\\\"; break;
      case '\n': out += "\\n"; break;
      case '\r': out += "\\r"; break;
      case '\t': out += "\\t"; break;
      default: out += c;
    }
  }
  return out;
}

static std::string jsonUnescape(const std::string& s) {
  std::string out;
  out.reserve(s.size());
  for (size_t i = 0; i < s.size(); i++) {
    if (s[i] == '\\' && i + 1 < s.size()) {
      switch (s[i + 1]) {
        case '"': out += '"'; break;
        case '\\': out += '\\'; break;
        case 'n': out += '\n'; break;
        case 'r': out += '\r'; break;
        case 't': out += '\t'; break;
        default: out += s[i + 1];
      }
      i++;
    } else {
      out += s[i];
    }
  }
  return out;
}

// ──────────────────────────────────────────────
// SHA-256 implementation (public domain)
// Adapted from https://github.com/983/SHA-256
// ──────────────────────────────────────────────

class SHA256 {
public:
  SHA256() { init(); }

  void update(const uint8_t* data, size_t len) {
    for (size_t i = 0; i < len; i++) {
      _buf[_buflen++] = data[i];
      if (_buflen == 64) {
        transform();
        _buflen = 0;
      }
    }
  }

  void update(const std::string& str) {
    update(reinterpret_cast<const uint8_t*>(str.data()), str.size());
  }

  std::string hex() {
    uint64_t bits = _originalBitlen + (_buflen * 8);
    _buf[_buflen++] = 0x80;
    if (_buflen > 56) {
      while (_buflen < 64) _buf[_buflen++] = 0;
      transform();
      _buflen = 0;
    }
    while (_buflen < 56) _buf[_buflen++] = 0;
    for (int i = 7; i >= 0; i--) {
      _buf[56 + i] = static_cast<uint8_t>(bits & 0xFF);
      bits >>= 8;
    }
    transform();

    static const char hexchars[] = "0123456789abcdef";
    std::string result;
    result.reserve(64);
    for (int i = 0; i < 8; i++) {
      for (int j = 28; j >= 0; j -= 4) {
        result += hexchars[(_state[i] >> j) & 0x0F];
      }
    }
    return result;
  }

private:
  uint32_t _state[8];
  uint8_t _buf[64];
  size_t _buflen = 0;
  uint64_t _originalBitlen = 0;

  void init() {
    _state[0] = 0x6a09e667;
    _state[1] = 0xbb67ae85;
    _state[2] = 0x3c6ef372;
    _state[3] = 0xa54ff53a;
    _state[4] = 0x510e527f;
    _state[5] = 0x9b05688c;
    _state[6] = 0x1f83d9ab;
    _state[7] = 0x5be0cd19;
    _buflen = 0;
    _originalBitlen = 0;
  }

  static uint32_t rotr(uint32_t x, uint32_t n) {
    return (x >> n) | (x << (32 - n));
  }

  static uint32_t ch(uint32_t x, uint32_t y, uint32_t z) {
    return (x & y) ^ (~x & z);
  }

  static uint32_t maj(uint32_t x, uint32_t y, uint32_t z) {
    return (x & y) ^ (x & z) ^ (y & z);
  }

  static uint32_t bigSigma0(uint32_t x) {
    return rotr(x, 2) ^ rotr(x, 13) ^ rotr(x, 22);
  }

  static uint32_t bigSigma1(uint32_t x) {
    return rotr(x, 6) ^ rotr(x, 11) ^ rotr(x, 25);
  }

  static uint32_t smallSigma0(uint32_t x) {
    return rotr(x, 7) ^ rotr(x, 18) ^ (x >> 3);
  }

  static uint32_t smallSigma1(uint32_t x) {
    return rotr(x, 17) ^ rotr(x, 19) ^ (x >> 10);
  }

  void transform() {
    uint32_t W[64];
    for (int t = 0; t < 16; t++) {
      W[t] = (static_cast<uint32_t>(_buf[t * 4]) << 24)
           | (static_cast<uint32_t>(_buf[t * 4 + 1]) << 16)
           | (static_cast<uint32_t>(_buf[t * 4 + 2]) << 8)
           | (static_cast<uint32_t>(_buf[t * 4 + 3]));
    }
    for (int t = 16; t < 64; t++) {
      W[t] = smallSigma1(W[t - 2]) + W[t - 7] + smallSigma0(W[t - 15]) + W[t - 16];
    }

    uint32_t a = _state[0], b = _state[1], c = _state[2], d = _state[3];
    uint32_t e = _state[4], f = _state[5], g = _state[6], h = _state[7];

    for (int t = 0; t < 64; t++) {
      uint32_t T1 = h + bigSigma1(e) + ch(e, f, g) + K[t] + W[t];
      uint32_t T2 = bigSigma0(a) + maj(a, b, c);
      h = g; g = f; f = e; e = d + T1;
      d = c; c = b; b = a; a = T1 + T2;
    }

    _state[0] += a; _state[1] += b; _state[2] += c; _state[3] += d;
    _state[4] += e; _state[5] += f; _state[6] += g; _state[7] += h;
    _originalBitlen += 512;
  }

  static const uint32_t K[64];
};

const uint32_t SHA256::K[64] = {
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
};

// ──────────────────────────────────────────────
// Permission types
// ──────────────────────────────────────────────

enum class PermissionDecision {
  AllowOnce,
  AllowForever,
  Deny,
};

struct PermissionEntry {
  std::string id;
  std::string wasmHash;
  std::string path;
  PermissionDecision decision;
  time_t grantedAt = 0;
};

// ──────────────────────────────────────────────
// JSON reader/writer for permissions (no deps)
// ──────────────────────────────────────────────

static std::vector<PermissionEntry> loadPermissions() {
  std::vector<PermissionEntry> entries;
  const char* home = std::getenv("HOME");
  if (!home) home = std::getenv("USERPROFILE");
  if (!home) return entries;

  std::string permPath = std::string(home) + "/.wasm-permissions.json";
  std::ifstream file(permPath);
  if (!file.is_open()) return entries;

  std::stringstream buffer;
  buffer << file.rdbuf();
  std::string content = buffer.str();

  // Minimal JSON parser — very basic, only handles our schema
  // Look for "entries" array
  auto entriesPos = content.find("\"entries\"");
  if (entriesPos == std::string::npos) return entries;

  auto arrayStart = content.find('[', entriesPos);
  if (arrayStart == std::string::npos) return entries;

  size_t pos = arrayStart + 1;
  int braceDepth = 0;
  std::string currentField;
  PermissionEntry current;
  bool inString = false;
  bool inObject = false;
  std::string stringBuf;

  auto flushString = [&]() {
    if (!currentField.empty()) {
      std::string val = jsonUnescape(stringBuf);
      if (currentField == "id") current.id = val;
      else if (currentField == "wasmHash") current.wasmHash = val;
      else if (currentField == "path") current.path = val;
      else if (currentField == "decision") {
        if (val == "AllowForever") current.decision = PermissionDecision::AllowForever;
        else if (val == "AllowOnce") current.decision = PermissionDecision::AllowOnce;
        else current.decision = PermissionDecision::Deny;
      } else if (currentField == "grantedAt") {
        current.grantedAt = static_cast<time_t>(std::stoll(val));
      }
      currentField.clear();
    }
    stringBuf.clear();
  };

  while (pos < content.size()) {
    char c = content[pos];
    if (inString) {
      if (c == '\\' && pos + 1 < content.size()) {
        stringBuf += c;
        stringBuf += content[pos + 1];
        pos += 2;
        continue;
      }
      if (c == '"') {
        inString = false;
        flushString();
        pos++;
        continue;
      }
      stringBuf += c;
      pos++;
      continue;
    }
    if (c == '"') {
      inString = true;
      stringBuf.clear();
      pos++;
      continue;
    }
    if (c == '{') {
      inObject = true;
      current = PermissionEntry();
      current.decision = PermissionDecision::Deny;
      current.grantedAt = 0;
      pos++;
      continue;
    }
    if (c == '}') {
      if (inObject) {
        entries.push_back(current);
        inObject = false;
      }
      pos++;
      continue;
    }
    if (c == '[') {
      pos++;
      continue;
    }
    if (c == ']') break;
    if (c == ':') {
      currentField = jsonUnescape(stringBuf);
      stringBuf.clear();
      pos++;
      continue;
    }
    if (c == ',' || c == ' ') {
      if (inObject && !stringBuf.empty() && currentField.empty()) {
        // Field name before colon — buffer it via stringBuf
      }
      pos++;
      continue;
    }
    // Number character (for grantedAt)
    if ((c >= '0' && c <= '9') || c == '-') {
      stringBuf += c;
      pos++;
      continue;
    }
    pos++;
  }

  return entries;
}

static void savePermissions(const std::vector<PermissionEntry>& entries) {
  const char* home = std::getenv("HOME");
  if (!home) home = std::getenv("USERPROFILE");
  if (!home) return;

  std::string permPath = std::string(home) + "/.wasm-permissions.json";
  std::ofstream file(permPath);
  if (!file.is_open()) return;

  file << "{" << std::endl;
  file << "  \"entries\": [" << std::endl;

  for (size_t i = 0; i < entries.size(); i++) {
    const auto& e = entries[i];
    file << "    {" << std::endl;
    file << "      \"id\": \"" << jsonEscape(e.id) << "\"," << std::endl;
    file << "      \"wasmHash\": \"" << jsonEscape(e.wasmHash) << "\"," << std::endl;
    file << "      \"path\": \"" << jsonEscape(e.path) << "\"," << std::endl;

    std::string decision;
    switch (e.decision) {
      case PermissionDecision::AllowForever: decision = "AllowForever"; break;
      case PermissionDecision::AllowOnce: decision = "AllowOnce"; break;
      case PermissionDecision::Deny: decision = "Deny"; break;
    }
    file << "      \"decision\": \"" << decision << "\"," << std::endl;
    file << "      \"grantedAt\": " << e.grantedAt << std::endl;

    file << "    }";
    if (i < entries.size() - 1) file << ",";
    file << std::endl;
  }

  file << "  ]" << std::endl;
  file << "}" << std::endl;
}

// ──────────────────────────────────────────────
// Permission ID computation
// ──────────────────────────────────────────────

static std::string computePermissionId(const std::string& wasmHash, const std::string& path) {
  SHA256 sha;
  sha.update(wasmHash);
  sha.update(":");
  sha.update(path);
  return sha.hex();
}

// ──────────────────────────────────────────────
// Path validation
// ──────────────────────────────────────────────

static std::string resolveRealPath(const std::string& path) {
  char resolved[PATH_MAX];
  if (::realpath(path.c_str(), resolved) != nullptr) {
    return std::string(resolved);
  }
  return "";
}

static bool isPathAllowed(const std::string& realPath, const std::vector<std::string>& allowedRoots) {
  if (allowedRoots.empty()) return false;

  std::string normalized = resolveRealPath(realPath);
  if (normalized.empty()) return false;

  for (const auto& root : allowedRoots) {
    std::string normalizedRoot = resolveRealPath(root);
    if (normalizedRoot.empty()) continue;

    std::string rootWithSep = normalizedRoot;
    if (!rootWithSep.empty() && rootWithSep.back() != '/') {
      rootWithSep += '/';
    }

    if (normalized == normalizedRoot) return true;
    if (normalized.rfind(rootWithSep, 0) == 0) return true;
  }

  return false;
}

// ──────────────────────────────────────────────
// Terminal popup
// ──────────────────────────────────────────────

static PermissionDecision promptUser(const std::string& wasmHash, const std::string& path) {
  std::cerr << std::endl;
  std::cerr << "╔══════════════════════════════════════════════╗" << std::endl;
  std::cerr << "║  Filesystem Access Request                  ║" << std::endl;
  std::cerr << "╠══════════════════════════════════════════════╣" << std::endl;
  std::cerr << "║  A WASM module wants to access:             ║" << std::endl;
  std::cerr << "║    " << path << std::endl;
  std::cerr << "║                                              ║" << std::endl;
  std::cerr << "║  Options:                                    ║" << std::endl;
  std::cerr << "║    [a] Allow once (5 min)                    ║" << std::endl;
  std::cerr << "║    [f] Allow forever                         ║" << std::endl;
  std::cerr << "║    [d] Deny                                  ║" << std::endl;
  std::cerr << "╚══════════════════════════════════════════════╝" << std::endl;
  std::cerr << "Choice (a/f/d): ";

  std::string choice;
  std::getline(std::cin, choice);

  if (choice == "a" || choice == "A") {
    return PermissionDecision::AllowOnce;
  } else if (choice == "f" || choice == "F") {
    return PermissionDecision::AllowForever;
  } else {
    return PermissionDecision::Deny;
  }
}

// ──────────────────────────────────────────────
// TTL check for AllowOnce
// ──────────────────────────────────────────────

static bool isAllowOnceExpired(const PermissionEntry& entry) {
  if (entry.decision != PermissionDecision::AllowOnce) return false;
  const time_t TTL = 300; // 5 minutes
  return (std::time(nullptr) - entry.grantedAt) > TTL;
}

// ──────────────────────────────────────────────
// Main entry point: request a path from WASM
// ──────────────────────────────────────────────

static int32_t requestPath(const std::string& path,
                           const std::vector<std::string>& allowedRoots,
                           const std::string& wasmModuleHash) {
  if (allowedRoots.empty()) return -2;

  // Resolve real path
  std::string realPath = resolveRealPath(path);
  if (realPath.empty()) {
    return -2; // Not found / cannot resolve
  }

  // Check path traversal
  if (!isPathAllowed(realPath, allowedRoots)) {
    return -1; // Traversal detected
  }

  // Compute permission ID
  // Load existing permissions
  auto entries = loadPermissions();

  // Compute permission ID from wasmModuleHash and real path
  std::string permId = computePermissionId(wasmModuleHash, realPath);

  // Check if a decision was already made
  for (const auto& entry : entries) {
    if (entry.id == permId) {
      if (entry.decision == PermissionDecision::Deny) return 0;
      if (entry.decision == PermissionDecision::AllowForever) {
        int fd = ::open(realPath.c_str(), O_RDONLY);
        if (fd < 0) return -2; // errno
        return fd;
      }
      if (entry.decision == PermissionDecision::AllowOnce) {
        if (isAllowOnceExpired(entry)) {
          // Remove expired entry and re-prompt
          break;
        }
        int fd = ::open(realPath.c_str(), O_RDONLY);
        if (fd < 0) return -2;
        return fd;
      }
    }
  }

  // No valid decision found — prompt user
  PermissionDecision decision = promptUser(wasmModuleHash, realPath);

  // Save decision
  PermissionEntry newEntry;
  newEntry.id = permId;
  newEntry.wasmHash = wasmModuleHash;
  newEntry.path = realPath;
  newEntry.decision = decision;
  newEntry.decision = decision;
  newEntry.grantedAt = std::time(nullptr);

  // Remove any old entry for this same ID (e.g. expired AllowOnce)
  entries.erase(
    std::remove_if(entries.begin(), entries.end(),
      [&](const PermissionEntry& e) { return e.id == permId; }),
    entries.end()
  );

  entries.push_back(newEntry);
  savePermissions(entries);

  if (decision == PermissionDecision::Deny) return 0;

  int fd = ::open(realPath.c_str(), O_RDONLY);
  if (fd < 0) return -2;
  return fd;
}

} // namespace FsRuntime

#endif // WASM_LINKER_FS_RUNTIME_H
