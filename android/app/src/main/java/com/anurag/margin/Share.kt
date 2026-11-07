package com.anurag.margin

import java.io.ByteArrayOutputStream
import java.net.URLDecoder
import java.util.Base64
import java.util.zip.DataFormatException
import java.util.zip.Deflater
import java.util.zip.Inflater

object Share {
    const val ORIGIN = "https://margin-eight-fawn.vercel.app"
    const val PREFIX = "s1."
    val hosts = setOf("margin-eight-fawn.vercel.app", "margin-anurag2293s-projects.vercel.app")
    private val tokenChars = Regex("^[A-Za-z0-9_-]+$")

    fun link(snapshot: Snapshot): String? {
        val bytes = SnapshotJson.canonical(snapshot).toByteArray(Charsets.UTF_8)
        if (bytes.size > Limits.MAX_BYTES) return null
        val deflater = Deflater(Deflater.BEST_COMPRESSION, true)
        deflater.setInput(bytes)
        deflater.finish()
        val out = ByteArrayOutputStream()
        val buffer = ByteArray(4096)
        while (!deflater.finished()) out.write(buffer, 0, deflater.deflate(buffer))
        deflater.end()
        val token = Base64.getUrlEncoder().withoutPadding().encodeToString(out.toByteArray())
        if (token.length > Limits.MAX_TOKEN) return null
        return "$ORIGIN/#$PREFIX$token"
    }

    fun decode(token: String): ParseResult {
        if (token.isEmpty()) return ParseResult.Failed("This reader link is empty.")
        if (token.length > Limits.MAX_TOKEN) return ParseResult.Failed("This reader link is too long.")
        if (!tokenChars.matches(token)) {
            return ParseResult.Failed("This reader link contains characters Margin does not use.")
        }
        val compressed = try {
            Base64.getUrlDecoder().decode(token)
        } catch (_: IllegalArgumentException) {
            return ParseResult.Failed("This reader link could not be decoded.")
        }
        val inflater = Inflater(true)
        val out = ByteArrayOutputStream()
        try {
            inflater.setInput(compressed + byteArrayOf(0))
            val buffer = ByteArray(4096)
            while (!inflater.finished()) {
                val count = inflater.inflate(buffer)
                if (count == 0 && (inflater.needsInput() || inflater.needsDictionary())) break
                out.write(buffer, 0, count)
                if (out.size() > Limits.MAX_BYTES) {
                    return ParseResult.Failed("This reader link unpacks to more than 48 KB.")
                }
            }
            if (!inflater.finished()) {
                return ParseResult.Failed("This reader link is damaged and could not be unpacked.")
            }
        } catch (_: DataFormatException) {
            return ParseResult.Failed("This reader link is damaged and could not be unpacked.")
        } finally {
            inflater.end()
        }
        val decoder = Charsets.UTF_8.newDecoder()
        val json = try {
            decoder.decode(java.nio.ByteBuffer.wrap(out.toByteArray())).toString()
        } catch (_: java.nio.charset.CharacterCodingException) {
            return ParseResult.Failed("This reader link did not contain text.")
        }
        return SnapshotParser.parse(json)
    }

    /** The share token in a Margin reader link, or null if the text is not one. */
    fun tokenFromLink(text: String): String? {
        val trimmed = text.trim()
        val match = Regex("""^https?://([^/?#\s]+)[^#\s]*#(\S+)$""", RegexOption.IGNORE_CASE).matchEntire(trimmed)
            ?: return null
        val host = match.groupValues[1].lowercase()
        val local = host.startsWith("127.0.0.1") || host.startsWith("localhost")
        if (host !in hosts && !local) return null
        val fragment = try {
            URLDecoder.decode(match.groupValues[2].replace("+", "%2B"), "UTF-8")
        } catch (_: Exception) {
            match.groupValues[2]
        }
        return fragment.takeIf { it.startsWith(PREFIX) }?.removePrefix(PREFIX)
    }

    /** Finds a reader link anywhere in shared text, such as a chat message. */
    fun findLink(text: String): String? =
        Regex("""https?://\S+#s1\.[A-Za-z0-9_-]+""").findAll(text).map { it.value }
            .firstOrNull { tokenFromLink(it) != null }
}

sealed interface Opened {
    data class Post(val snapshot: Snapshot) : Opened
    data class UrlOnly(val url: String, val x: Boolean) : Opened
    data class Invalid(val error: String) : Opened
}

object Importer {
    fun open(input: String): Opened {
        val text = input.removePrefix("﻿").trim()
        if (text.isEmpty()) return Opened.Invalid("Paste a snapshot first.")
        if (!text.startsWith("{")) {
            val link = Share.tokenFromLink(text) ?: Share.findLink(text)?.let(Share::tokenFromLink)
            if (link != null) return Share.decode(link).toOpened()
        }
        if (!text.startsWith("{") && Urls.looksLikeBareUrl(text)) {
            return Opened.UrlOnly(text, Urls.isXFamilyUrl(text))
        }
        val parsed = SnapshotParser.parse(text)
        if (parsed is ParseResult.Failed && Urls.looksLikeBareUrl(text)) {
            return Opened.UrlOnly(text, Urls.isXFamilyUrl(text))
        }
        return parsed.toOpened()
    }

    private fun ParseResult.toOpened(): Opened = when (this) {
        is ParseResult.Ok -> Opened.Post(snapshot)
        is ParseResult.Failed -> Opened.Invalid(error)
    }
}
