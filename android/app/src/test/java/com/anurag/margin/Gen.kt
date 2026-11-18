package com.anurag.margin

import org.json.JSONArray
import org.json.JSONObject
import kotlin.random.Random

/** Seeded generators shaped like the web suite's fast-check arbitraries (src/test/arbitraries.ts). */
object Gen {
    val HOSTILE = listOf(
        "<script>alert(1)</script>",
        "<img src=x onerror=alert(1)>",
        "javascript:alert(1)",
        "JaVaScRiPt:alert(1)",
        "data:text/html,<b>x</b>",
        "&amp;&lt;&#x3C;",
        "{{constructor.constructor('alert(1)')()}}",
        "__proto__",
        "https://x.com/someone/status/1",
        "https://t.co/abc",
        "https://pbs.twimg.com/media/a.jpg",
        "https://example.com/field-notes?q=1.",
        "(https://example.com/a_(b))",
        "https://user:pass@example.com/",
        "https://example.com:8443/",
        "https://exa。mple.com/",
        "‮gnp.exe",
        "‏⁦rtl⁩",
        "\u0000\u0007\u001B\u007F",
        "\r\n\r",
        "\t  　",
        "café 日本語 🌳 👩🏽‍💻 é",
        "\uD800",
        "\uDFFF",
        "  ",
        "﻿",
    )

    /** The characters JavaScript's \s and String.prototype.trim treat as white space. */
    const val JS_SPACE = "\t\n\u000B\u000C\r                  　﻿"

    fun jsTrim(value: String): String = value.trim { it in JS_SPACE }

    /** Runs [check] on [runs] values from [gen], naming the failing value. */
    fun <T> forAll(runs: Int, seed: Int, gen: (Random) -> T, check: (T) -> Unit) {
        val random = Random(seed)
        repeat(runs) { run ->
            val value = gen(random)
            try {
                check(value)
            } catch (error: Throwable) {
                val shown = if (value is String) JSONObject.quote(value) else value.toString()
                throw AssertionError("run $run (seed $seed) failed for $shown: ${error.message}", error)
            }
        }
    }

    fun <T> pick(random: Random, vararg values: T): T = values[random.nextInt(values.size)]

    /** Any UTF-16 text, lone surrogates included, like fast-check's binary strings. */
    fun binaryString(random: Random, maxLength: Int): String = buildString {
        repeat(random.nextInt(maxLength + 1)) {
            when (random.nextInt(10)) {
                in 0..4 -> append(random.nextInt(0x80).toChar())
                in 5..6 -> append(random.nextInt(0x80, 0x10000).toChar())
                else -> appendCodePoint(random.nextInt(0x10000, 0x110000))
            }
        }
    }

    fun webUrl(random: Random): String = buildString {
        append(pick(random, "https://", "https://", "http://"))
        repeat(random.nextInt(1, 4)) { append(label(random)).append('.') }
        append(buildString { repeat(random.nextInt(2, 4)) { append(('a'..'z').random(random)) } })
        val pathChars = "abcXYZ019-._~!$&'()*+,;=:@"
        repeat(random.nextInt(4)) {
            append('/')
            repeat(random.nextInt(6)) { append(pathChars[random.nextInt(pathChars.length)]) }
            if (random.nextInt(4) == 0) append("%F0%9F%8C%B3")
        }
        if (random.nextBoolean()) append("?q=").append(label(random))
        if (random.nextInt(3) == 0) append('#').append(label(random))
    }

    private fun label(random: Random): String {
        val chars = "abcdefghijklmnopqrstuvwxyz0123456789"
        return buildString {
            append(chars[random.nextInt(chars.length)])
            repeat(random.nextInt(8)) { append(chars[random.nextInt(chars.length)]) }
        }
    }

    /** Text that mixes unicode, hostile markup, URLs, control characters, and lone surrogates. */
    fun hostileText(random: Random, maxPieces: Int = 12): String = buildString {
        repeat(random.nextInt(maxPieces + 1)) {
            when (random.nextInt(8)) {
                in 0..2 -> append(binaryString(random, 20))
                in 3..5 -> append(HOSTILE[random.nextInt(HOSTILE.size)])
                6 -> append(webUrl(random))
                else -> append(pick(random, " ", "\n", ".", ")", "]", ",", "?"))
            }
        }
    }

    private fun handle(random: Random): String {
        val chars = "ABCabcxyz0189_"
        val body = buildString { repeat(random.nextInt(1, 16)) { append(chars[random.nextInt(chars.length)]) } }
        return if (random.nextBoolean()) "@$body" else body
    }

    private fun isoTime(random: Random): String {
        val millis = random.nextLong(631_152_000_000L, 3_818_102_399_000L)
        return java.time.Instant.ofEpochMilli(millis).toString().let {
            if (it.contains('.')) it else it.removeSuffix("Z") + ".000Z"
        }
    }

    private fun statusUrl(random: Random): String {
        val origin = pick(random, "https://x.com", "https://twitter.com", "https://mobile.twitter.com", "https://www.x.com")
        val user = handle(random).removePrefix("@")
        val id = (1..random.nextInt(1, 19)).joinToString("") { if (it == 1) "${random.nextInt(1, 10)}" else "${random.nextInt(10)}" }
        return "$origin/$user/status/$id" + pick(random, "", "?s=20", "#frag", "/photo/1", "/")
    }

    private fun name(random: Random): String =
        pick(random, "Ada", "Ada M. Example", "日本語の名前", "🌳 Tree", "  spaced  ", "x".repeat(random.nextInt(1, 50)), binaryString(random, 12))

    private fun post(random: Random, quote: Boolean): JSONObject = JSONObject().apply {
        put("authorName", name(random))
        put("authorHandle", handle(random))
        put("text", hostileText(random))
        if (random.nextBoolean()) put("createdAt", isoTime(random))
        if (random.nextBoolean()) put("sourceUrl", statusUrl(random))
        if (random.nextBoolean()) put("lang", pick(random, "en", "ja", "pt-BR", "zh-Hant-TW"))
        if (random.nextBoolean()) {
            put("media", JSONArray().apply {
                repeat(random.nextInt(5)) {
                    put(JSONObject().apply {
                        put("kind", pick(random, "photo", "video", "gif", "audio"))
                        if (random.nextBoolean()) put("alt", hostileText(random, 4))
                    })
                }
            })
        }
        if (random.nextBoolean()) {
            put("profile", JSONObject().apply {
                if (random.nextBoolean()) put("avatar", "data:image/${pick(random, "jpeg", "png", "webp")};base64,iVBORw0KGgo=")
                if (random.nextBoolean()) put("bio", hostileText(random, 6))
                if (random.nextBoolean()) put("location", binaryString(random, 60))
                if (random.nextBoolean()) put("website", webUrl(random).replaceFirst("http://", "https://"))
                if (random.nextBoolean()) put("joinedAt", pick(random, "2014-03", "2014-03-21", "2014-03-01T00:30:00+09:00", "2009-12"))
                if (random.nextBoolean()) put("followers", random.nextLong(0, 2_000_000_000L))
                if (random.nextBoolean()) put("following", random.nextInt(0, Int.MAX_VALUE))
                if (random.nextBoolean()) put("verified", random.nextBoolean())
            })
        }
        if (quote && random.nextBoolean()) put("quote", post(random, quote = false))
    }

    /** Raw snapshot JSON in the shape a producer writes. Most, not all, are accepted by the parser. */
    fun rawSnapshot(random: Random): String = JSONObject().apply {
        put("format", Limits.FORMAT)
        put("version", Limits.VERSION)
        if (random.nextBoolean()) put("example", random.nextBoolean())
        if (random.nextBoolean()) put("unknown", JSONArray(listOf(1, "two", null, true)))
        put("post", post(random, quote = true))
    }.toString()
}
