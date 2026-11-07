package com.anurag.margin

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

    /** Returns the lowercased host of a plain default-port https URL, or null. */
    fun plainHttpsHost(value: String): String? {
        if (value.any { it.code <= 0x20 || it.code == 0x7F || it == '\\' || it == '@' }) return null
        val match = httpsParts.matchEntire(value) ?: return null
        val host = match.groupValues[1].lowercase().removeSuffix(".")
        if (host.isEmpty() || !hostChars.matches(host) || host.startsWith(".") || host.contains("..")) return null
        return host
    }

    fun isPlainHttps(value: String): Boolean = plainHttpsHost(value) != null

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
    private val urlPattern = Regex("""https://[^\s<>"'`]+""", RegexOption.IGNORE_CASE)

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
        if (Urls.isBlockedHost(host)) return TextPart.Blocked(raw)
        return TextPart.Link(raw, raw)
    }

    private fun trimTrailing(raw: String): Pair<String, String> {
        var url = raw
        var rest = ""
        Regex("[.,;:!?]+$").find(url)?.let {
            rest = it.value
            url = url.dropLast(it.value.length)
        }
        while (url.endsWith(")") && url.count { it == '(' } < url.count { it == ')' }) {
            rest = ")$rest"
            url = url.dropLast(1)
        }
        while (url.endsWith("]") && url.count { it == '[' } < url.count { it == ']' }) {
            rest = "]$rest"
            url = url.dropLast(1)
        }
        return url to rest
    }
}
