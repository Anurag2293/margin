package com.anurag.margin

import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject
import org.json.JSONTokener
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.YearMonth

object Limits {
    const val MAX_BYTES = 48 * 1024
    const val MAX_TEXT = 12_000
    const val MAX_NAME = 50
    const val MAX_ALT = 1_000
    const val MAX_MEDIA = 4
    const val MAX_TOKEN = 24_000
    const val MAX_LANG = 35
    const val MAX_SOURCE_URL = 500
    const val MAX_BIO = 500
    const val MAX_LOCATION = 100
    const val MAX_WEBSITE = 300
    const val MAX_AVATAR = 20_000
    const val MAX_COUNT = 1_000_000_000_000L
    const val FORMAT = "single-post-snapshot"
    const val VERSION = 1
}

enum class MediaKind(val key: String, val label: String) {
    PHOTO("photo", "Photo"),
    VIDEO("video", "Video"),
    GIF("gif", "Animation"),
    AUDIO("audio", "Audio"),
}

data class Media(val kind: MediaKind, val alt: String? = null)

data class Profile(
    val avatar: String? = null,
    val bio: String? = null,
    val location: String? = null,
    val website: String? = null,
    val joinedAt: String? = null,
    val followers: Long? = null,
    val following: Long? = null,
    val posts: Long? = null,
    val verified: Boolean = false,
)

data class Post(
    val authorName: String,
    val authorHandle: String,
    val text: String,
    val createdAt: String? = null,
    val sourceUrl: String? = null,
    val lang: String? = null,
    val media: List<Media> = emptyList(),
    val profile: Profile? = null,
    val quote: Post? = null,
)

data class Snapshot(val post: Post, val example: Boolean = false)

sealed interface ParseResult {
    data class Ok(val snapshot: Snapshot) : ParseResult
    data class Failed(val error: String) : ParseResult
}

class SnapshotException(message: String) : Exception(message)

object SnapshotParser {
    private val urlKeys = listOf("url", "src", "href", "source", "previewUrl", "poster")
    private val isoTime =
        Regex("""^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$""")
    private val joined = Regex("""^\d{4}-\d{2}(?:-\d{2})?$""")
    private val avatar = Regex("""^data:image/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$""")
    private val langTag = Regex("""^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,3}$""")
    private val handle = Regex("""^[A-Za-z0-9_]{1,15}$""")
    private val control = Regex("[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]")
    private val bidi = Regex("[‎‏‪-‮⁦-⁩]")

    fun parse(input: String): ParseResult = try {
        val text = input.removePrefix("﻿")
        if (text.toByteArray(Charsets.UTF_8).size > Limits.MAX_BYTES) {
            fail("That snapshot is larger than 48 KB.")
        }
        val data = try {
            val tokener = JSONTokener(text.trim())
            tokener.nextValue().also { if (tokener.more()) fail("This is not valid JSON.") }
        } catch (_: JSONException) {
            fail("This is not valid JSON.")
        }
        ParseResult.Ok(parseValue(data))
    } catch (error: SnapshotException) {
        ParseResult.Failed(error.message ?: "Could not open that snapshot.")
    }

    private fun parseValue(data: Any?): Snapshot {
        if (data !is JSONObject) fail("A snapshot must be a JSON object.")
        if (data.opt("format") != Limits.FORMAT) fail("format must be single-post-snapshot.")
        val version = data.opt("version")
        if (version !is Number || version.toDouble() != Limits.VERSION.toDouble()) fail("version must be 1.")
        val example = data.opt("example")
        if (example != null && example !is Boolean) fail("example must be true or false.")
        if (!data.has("post")) fail("post is missing.")
        return Snapshot(parsePost(data.opt("post"), "Post"), example == true)
    }

    private fun parsePost(value: Any?, label: String): Post {
        if (value !is JSONObject) fail("$label must be a JSON object.")
        if (label == "Quoted post" && value.has("quote")) fail("A quoted post cannot contain another quote.")

        val name = parseName(value.opt("authorName"), label)
        val authorHandle = parseHandle(value.opt("authorHandle"), label)
        val media = parseMedia(value.opt("media"), label)
        val text = parseBody(value.opt("text"), label, media.isNotEmpty())
        val quote = if (label == "Post" && value.has("quote")) {
            val quoteValue = value.opt("quote")
            if (quoteValue == null || quoteValue == JSONObject.NULL) fail("quote must be a JSON object.")
            parsePost(quoteValue, "Quoted post")
        } else null

        return Post(
            authorName = name,
            authorHandle = authorHandle,
            text = text,
            createdAt = parseOptionalTime(value.opt("createdAt"), label),
            sourceUrl = parseOptionalSource(value.opt("sourceUrl"), label),
            lang = parseOptionalLang(value.opt("lang"), label),
            media = media,
            profile = parseOptionalProfile(value.opt("profile"), label),
            quote = quote,
        )
    }

    private fun parseName(value: Any?, label: String): String {
        if (value !is String) fail("$label authorName must be text.")
        val cleaned = clean(value, multiline = false, stripBidi = true)
        if (cleaned.isEmpty()) fail("$label authorName is empty.")
        if (cleaned.length > Limits.MAX_NAME) fail("$label authorName is longer than ${Limits.MAX_NAME} characters.")
        return cleaned
    }

    private fun parseHandle(value: Any?, label: String): String {
        if (value !is String) fail("$label authorHandle must be text.")
        val cleaned = clean(value, multiline = false, stripBidi = true).removePrefix("@")
        if (!handle.matches(cleaned)) {
            fail("$label authorHandle must be 1 to 15 letters, numbers, or underscores.")
        }
        return cleaned
    }

    private fun parseBody(value: Any?, label: String, allowEmpty: Boolean): String {
        if (value == null) fail("$label text is missing.")
        if (value !is String) fail("$label text must be text.")
        val cleaned = clean(value, multiline = true, stripBidi = false)
        if (cleaned.isEmpty() && !allowEmpty) fail("$label text is empty.")
        if (cleaned.length > Limits.MAX_TEXT) fail("$label text is longer than 12,000 characters.")
        return cleaned
    }

    private fun parseOptionalTime(value: Any?, label: String): String? {
        if (value == null) return null
        val message = "$label createdAt must be an ISO-8601 timestamp like 2026-04-02T16:30:00.000Z."
        if (value !is String || value.isBlank()) fail(message)
        val time = value.trim()
        if (!isoTime.matches(time) || parseInstant(time) == null) fail(message)
        return time
    }

    private fun parseOptionalSource(value: Any?, label: String): String? {
        if (value == null) return null
        val message = "$label sourceUrl must be an https link to a public post on x.com or twitter.com."
        if (value !is String) fail(message)
        return Urls.canonicalStatusUrl(value) ?: fail(message)
    }

    private fun parseOptionalLang(value: Any?, label: String): String? {
        if (value == null) return null
        val message = "$label lang must be a language tag like en or pt-BR."
        if (value !is String) fail(message)
        val lang = value.trim()
        if (!langTag.matches(lang) || lang.length > Limits.MAX_LANG) fail(message)
        return lang
    }

    private fun parseMedia(value: Any?, label: String): List<Media> {
        if (value == null) return emptyList()
        if (value !is JSONArray) fail("$label media must be an array.")
        if (value.length() > Limits.MAX_MEDIA) fail("$label media can include at most ${Limits.MAX_MEDIA} items.")
        return (0 until value.length()).map { index ->
            val where = "$label media item ${index + 1}"
            val item = value.opt(index)
            if (item !is JSONObject) fail("$where must be a JSON object.")
            for (key in urlKeys) {
                if (item.has(key) && !item.isNull(key)) {
                    fail("Media cannot include a URL. This reader does not load images or video.")
                }
            }
            val kind = MediaKind.entries.firstOrNull { it.key == item.opt("kind") }
                ?: fail("$where kind must be photo, video, gif, or audio.")
            var alt: String? = null
            if (item.has("alt")) {
                val raw = item.opt("alt")
                if (raw !is String) fail("$where alt must be text.")
                val cleaned = clean(raw, multiline = true, stripBidi = false)
                if (cleaned.length > Limits.MAX_ALT) fail("$where alt is longer than 1,000 characters.")
                if (cleaned.isNotEmpty()) alt = cleaned
            }
            Media(kind, alt)
        }
    }

    private fun parseOptionalProfile(value: Any?, label: String): Profile? {
        if (value == null || value == JSONObject.NULL) return null
        val where = "$label profile"
        if (value !is JSONObject) fail("$where must be a JSON object.")

        val avatarValue = value.opt("avatar")?.let { raw ->
            if (raw !is String) fail("$where avatar must be a data:image URI.")
            val trimmed = raw.trim()
            if (trimmed.length > Limits.MAX_AVATAR) fail("$where avatar is longer than 20,000 characters.")
            if (!avatar.matches(trimmed)) fail("$where avatar must be a base64 data:image URI of a JPEG, PNG, or WebP.")
            trimmed
        }

        fun text(key: String, max: Int, multiline: Boolean): String? {
            val raw = value.opt(key) ?: return null
            if (raw !is String) fail("$where $key must be text.")
            val cleaned = clean(raw, multiline = multiline, stripBidi = !multiline)
            if (cleaned.length > max) fail("$where $key is longer than $max characters.")
            return cleaned.ifEmpty { null }
        }

        val website = value.opt("website")?.let { raw ->
            val message = "$where website must be an https link."
            if (raw !is String) fail(message)
            val trimmed = raw.trim()
            if (trimmed.length > Limits.MAX_WEBSITE || !Urls.isPlainHttps(trimmed)) fail(message)
            trimmed
        }

        val joinedAt = value.opt("joinedAt")?.let { raw ->
            val message = "$where joinedAt must be a date like 2014-03 or 2014-03-21."
            if (raw !is String) fail(message)
            val trimmed = raw.trim()
            val valid = (joined.matches(trimmed) && parseJoined(trimmed) != null) ||
                (isoTime.matches(trimmed) && parseInstant(trimmed) != null)
            if (!valid) fail(message)
            trimmed
        }

        fun count(key: String): Long? {
            val raw = value.opt(key) ?: return null
            val message = "$where $key must be a whole number of zero or more."
            val number = when (raw) {
                is Int -> raw.toLong()
                is Long -> raw
                is Double -> if (raw % 1.0 == 0.0 && raw <= Limits.MAX_COUNT) raw.toLong() else fail(message)
                is java.math.BigDecimal -> raw.toLongExactOrNull() ?: fail(message)
                else -> fail(message)
            }
            if (number < 0 || number > Limits.MAX_COUNT) fail(message)
            return number
        }

        val verified = value.opt("verified")?.let { raw ->
            if (raw !is Boolean) fail("$where verified must be true or false.")
            raw
        } ?: false

        val profile = Profile(
            avatar = avatarValue,
            bio = text("bio", Limits.MAX_BIO, multiline = true),
            location = text("location", Limits.MAX_LOCATION, multiline = false),
            website = website,
            joinedAt = joinedAt,
            followers = count("followers"),
            following = count("following"),
            posts = count("posts"),
            verified = verified,
        )
        return if (profile == Profile()) null else profile
    }

    private fun java.math.BigDecimal.toLongExactOrNull(): Long? =
        try { toBigIntegerExact().longValueExact() } catch (_: ArithmeticException) { null }

    private fun clean(input: String, multiline: Boolean, stripBidi: Boolean): String {
        var value = input.replace("\r\n", "\n").replace('\r', '\n').replace(control, "")
        if (stripBidi) value = value.replace(bidi, "")
        if (!multiline) value = value.replace(Regex("\\s+"), " ")
        return value.trim()
    }

    private fun fail(message: String): Nothing = throw SnapshotException(message)
}

fun parseInstant(value: String): OffsetDateTime? = try {
    OffsetDateTime.parse(value)
} catch (_: Exception) {
    null
}

fun parseJoined(value: String): LocalDate? = try {
    if (value.length == 7) YearMonth.parse(value).atDay(1) else LocalDate.parse(value)
} catch (_: Exception) {
    null
}

object SnapshotJson {
    fun canonical(snapshot: Snapshot): String = toJson(snapshot).toString()

    fun pretty(snapshot: Snapshot): String = toJson(snapshot).toString(2)

    private fun toJson(snapshot: Snapshot): JSONObject = JSONObject().apply {
        put("format", Limits.FORMAT)
        put("version", Limits.VERSION)
        if (snapshot.example) put("example", true)
        put("post", post(snapshot.post))
    }

    private fun post(post: Post): JSONObject = JSONObject().apply {
        put("authorName", post.authorName)
        put("authorHandle", post.authorHandle)
        put("text", post.text)
        post.createdAt?.let { put("createdAt", it) }
        post.sourceUrl?.let { put("sourceUrl", it) }
        post.lang?.let { put("lang", it) }
        post.quote?.let { put("quote", post(it)) }
        if (post.media.isNotEmpty()) {
            put("media", JSONArray().apply {
                post.media.forEach { item ->
                    put(JSONObject().apply {
                        put("kind", item.kind.key)
                        item.alt?.let { put("alt", it) }
                    })
                }
            })
        }
        post.profile?.let { profile ->
            put("profile", JSONObject().apply {
                profile.avatar?.let { put("avatar", it) }
                profile.bio?.let { put("bio", it) }
                profile.location?.let { put("location", it) }
                profile.website?.let { put("website", it) }
                profile.joinedAt?.let { put("joinedAt", it) }
                profile.followers?.let { put("followers", it) }
                profile.following?.let { put("following", it) }
                profile.posts?.let { put("posts", it) }
                if (profile.verified) put("verified", true)
            })
        }
    }
}
