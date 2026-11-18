package com.anurag.margin

import java.math.BigInteger
import java.net.IDN

object Urls {
    private val statusHosts = setOf("x.com", "www.x.com", "twitter.com", "www.twitter.com", "mobile.twitter.com")
    private val blockedRoots = listOf("x.com", "twitter.com", "twimg.com", "t.co")
    private val httpsParts = Regex("""^https://([^/?#]+)([^?#]*)(\?[^#]*)?(#.*)?$""", RegexOption.IGNORE_CASE)
    private val statusPath = Regex("""^/(?:([A-Za-z0-9_]{1,15})/status|i/web/status)/(\d{1,20})(?:/.*)?$""")
    private val hostChars = Regex("""^[a-z0-9.-]+$""")

    fun isBlockedHost(hostname: String): Boolean {
        val host = hostname.trim().lowercase().removeSuffix(".").removePrefix("[").removeSuffix("]")
        if (host.isEmpty()) return false
        return blockedRoots.any { host == it || host.endsWith(".$it") }
    }

    /**
     * Returns the lowercased host of a plain default-port https URL, or null. With [allowIdn], a non-ASCII
     * host is converted to punycode first, as the browser's URL parser does.
     */
    fun plainHttpsHost(value: String, allowIdn: Boolean = false): String? {
        if (value.any { it.code <= 0x20 || it.code == 0x7F || it == '\\' || it == '@' }) return null
        val match = httpsParts.matchEntire(value) ?: return null
        val port = match.groupValues[1].substringAfter(':', "")
        if (port.isNotEmpty() && (!port.all { it in '0'..'9' } || port.toBigInteger() != BigInteger.valueOf(443))) return null
        val written = match.groupValues[1].substringBefore(':').removeSuffix(".")
        val host = if (allowIdn) {
            try {
                IDN.toASCII(written, IDN.ALLOW_UNASSIGNED).lowercase()
            } catch (_: IllegalArgumentException) {
                return null
            }
        } else {
            written.lowercase()
        }
        if (host.isEmpty() || !hostChars.matches(host) || host.startsWith(".") || host.contains("..")) return null
        return if (endsInNumber(host)) ipv4(host) else host
    }

    /** The browser's URL parser reads a host whose last label is a number as an IPv4 address. */
    private fun endsInNumber(host: String): Boolean {
        val last = host.substringAfterLast('.')
        return last.isNotEmpty() && (last.all { it in '0'..'9' } || (last.startsWith("0x") && last.drop(2).all { it in "0123456789abcdef" }))
    }

    /** The dotted form the URL parser gives an IPv4 host written in decimal, octal, or hex parts, or null where it fails. */
    private fun ipv4(host: String): String? {
        val parts = host.split('.')
        if (parts.size > 4) return null
        val numbers = parts.map { ipv4Number(it) ?: return null }
        val byte = BigInteger.valueOf(256)
        if (numbers.dropLast(1).any { it >= byte } || numbers.last() >= byte.pow(5 - parts.size)) return null
        var address = numbers.last()
        numbers.dropLast(1).forEachIndexed { index, number -> address += number * byte.pow(3 - index) }
        return (3 downTo 0).joinToString(".") { address.shiftRight(8 * it).and(BigInteger.valueOf(255)).toString() }
    }

    private fun ipv4Number(part: String): BigInteger? {
        val (digits, radix) = when {
            part.startsWith("0x") -> part.drop(2) to 16
            part.length > 1 && part.startsWith("0") -> part.drop(1) to 8
            else -> part to 10
        }
        if (part.isEmpty() || !digits.all { Character.digit(it, radix) >= 0 }) return null
        return if (digits.isEmpty()) BigInteger.ZERO else BigInteger(digits, radix)
    }

    fun isPlainHttps(value: String): Boolean = plainHttpsHost(value, allowIdn = true) != null

    fun canonicalStatusUrl(input: String): String? {
        val trimmed = input.trim()
        if (trimmed.isEmpty() || trimmed.length > Limits.MAX_SOURCE_URL) return null
        val host = plainHttpsHost(trimmed) ?: return null
        if (host !in statusHosts) return null
        val path = httpsParts.matchEntire(trimmed)!!.groupValues[2].trimEnd('/')
        val match = statusPath.matchEntire(path) ?: return null
        val id = match.groupValues[2]
        val canonicalHost = if (host.endsWith("twitter.com")) "twitter.com" else "x.com"
        val user = match.groupValues[1]
        return if (user.isNotEmpty()) "https://$canonicalHost/$user/status/$id"
        else "https://$canonicalHost/i/web/status/$id"
    }

    fun looksLikeBareUrl(text: String): Boolean {
        val trimmed = text.trim()
        if (trimmed.isEmpty() || trimmed.length > 2_000 || trimmed.any { it.isWhitespace() }) return false
        return Regex(
            """^(https?://|x\.com/|twitter\.com/|www\.x\.com/|www\.twitter\.com/|mobile\.twitter\.com/)""",
            RegexOption.IGNORE_CASE,
        ).containsMatchIn(trimmed)
    }

    fun isXFamilyUrl(text: String): Boolean {
        val trimmed = text.trim()
        val rest = trimmed.replace(Regex("^https?://", RegexOption.IGNORE_CASE), "")
        val host = rest.split('/', '?', '#').first().substringAfterLast('@').substringBefore(':').lowercase()
        return listOf("x.com", "twitter.com", "t.co").any { host == it || host.endsWith(".$it") }
    }
}

sealed interface TextPart {
    val value: String
    data class Plain(override val value: String) : TextPart
    data class Link(override val value: String, val href: String) : TextPart
    data class Blocked(override val value: String) : TextPart
}

object Linkify {
    private val urlPattern = Regex("""https://[^$JS_SPACE<>"'`]+""", RegexOption.IGNORE_CASE)

    fun split(text: String): List<TextPart> {
        val parts = mutableListOf<TextPart>()
        var cursor = 0
        for (match in urlPattern.findAll(text)) {
            val start = match.range.first
            if (start > cursor) parts += TextPart.Plain(text.substring(cursor, start))
            val (url, rest) = trimTrailing(match.value)
            parts += classify(url)
            if (rest.isNotEmpty()) parts += TextPart.Plain(rest)
            cursor = match.range.last + 1
        }
        if (cursor < text.length) parts += TextPart.Plain(text.substring(cursor))
        return parts
    }

    fun classify(raw: String): TextPart {
        if (raw.length > 2_000) return TextPart.Plain(raw)
        val host = Urls.plainHttpsHost(raw) ?: return TextPart.Plain(raw)
        val written = raw.substring("https://".length).takeWhile { it !in "/?#" }.removeSuffix(".").lowercase()
        if (host != written) return TextPart.Plain(raw)
        if (Urls.isBlockedHost(host)) return TextPart.Blocked(raw)
        return TextPart.Link(raw, raw)
    }

    private fun trimTrailing(raw: String): Pair<String, String> {
        val opens = mapOf(')' to raw.count { it == '(' }, ']' to raw.count { it == '[' })
        val closes = mutableMapOf(')' to raw.count { it == ')' }, ']' to raw.count { it == ']' })
        var end = raw.length
        while (end > 0) {
            val char = raw[end - 1]
            if (char in ".,;:!?") {
                end -= 1
            } else if (char in closes && opens.getValue(char) < closes.getValue(char)) {
                closes[char] = closes.getValue(char) - 1
                end -= 1
            } else {
                break
            }
        }
        return raw.substring(0, end) to raw.substring(end)
    }
}
