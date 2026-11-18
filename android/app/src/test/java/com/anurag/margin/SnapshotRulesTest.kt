package com.anurag.margin

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Ports src/lib/snapshot.test.ts, snapshot.properties.test.ts, and import.test.ts. */
class SnapshotRulesTest {
    private fun build(post: Map<String, Any?> = emptyMap(), extra: Map<String, Any?> = emptyMap()): String {
        val body = JSONObject().put("authorName", "Ada").put("authorHandle", "ada").put("text", "Hello")
        for ((key, value) in post) if (value === Absent) body.remove(key) else body.put(key, value ?: JSONObject.NULL)
        val root = JSONObject().put("format", Limits.FORMAT).put("version", Limits.VERSION)
        for ((key, value) in extra) root.put(key, value ?: JSONObject.NULL)
        return root.put("post", body).toString()
    }

    private object Absent

    private fun accepted(post: Map<String, Any?> = emptyMap(), extra: Map<String, Any?> = emptyMap()): Snapshot {
        val parsed = SnapshotParser.parse(build(post, extra))
        assertTrue("expected a valid snapshot, got $parsed", parsed is ParseResult.Ok)
        return (parsed as ParseResult.Ok).snapshot
    }

    private fun rejected(post: Map<String, Any?> = emptyMap(), extra: Map<String, Any?> = emptyMap()): String {
        val parsed = SnapshotParser.parse(build(post, extra))
        assertTrue("expected a rejection for $post", parsed is ParseResult.Failed)
        return (parsed as ParseResult.Failed).error
    }

    private fun assertContains(text: String, part: String, label: String = text) =
        assertTrue("$label: \"$text\" does not contain \"$part\"", text.contains(part))

    private fun quote(vararg pairs: Pair<String, Any?>) =
        JSONObject().put("authorName", "Q").put("authorHandle", "q").put("text", "t").apply { pairs.forEach { (k, v) -> put(k, v) } }

    private fun media(vararg items: JSONObject) = JSONArray(items.toList())

    private fun item(vararg pairs: Pair<String, Any?>) = JSONObject().apply { pairs.forEach { (k, v) -> put(k, v ?: JSONObject.NULL) } }

    @Test
    fun keepsMultilineUnicodeTextAQuoteAndMediaDescriptions() {
        val snapshot = accepted(mapOf(
            "authorName" to "Ada M. Example",
            "authorHandle" to "ada_example",
            "text" to "Line one 🌱\n\n日本語 — café “quotes”",
            "createdAt" to "2026-01-15T18:04:00.000Z",
            "sourceUrl" to "https://x.com/ada_example/status/99?s=20",
            "lang" to "ja",
            "quote" to JSONObject().put("authorName", "Quoted Poet").put("authorHandle", "@poet_example")
                .put("text", "A quoted line\nwith café").put("createdAt", "2026-01-14T08:00:00+00:00"),
            "media" to media(item("kind" to "photo", "alt" to "Window light"), item("kind" to "video", "alt" to "Rain")),
            "ignored" to "drop me",
        ))
        assertEquals("Line one 🌱\n\n日本語 — café “quotes”", snapshot.post.text)
        assertEquals("ada_example", snapshot.post.authorHandle)
        assertEquals("https://x.com/ada_example/status/99", snapshot.post.sourceUrl)
        assertEquals("poet_example", snapshot.post.quote?.authorHandle)
        assertTrue(snapshot.post.quote!!.text.contains("\n"))
        assertEquals(listOf(MediaKind.PHOTO, MediaKind.VIDEO), snapshot.post.media.map { it.kind })
        assertFalse(SnapshotJson.canonical(snapshot).contains("ignored"))
        assertTrue(SnapshotJson.pretty(snapshot).contains("Window light"))
    }

    @Test
    fun canonicalizesTwitterAndMobileStatusUrlsAndDropsPhotoSuffixes() {
        val snapshot = accepted(mapOf("sourceUrl" to "https://mobile.twitter.com/ada_example/status/42/photo/1"))
        assertEquals("https://twitter.com/ada_example/status/42", snapshot.post.sourceUrl)
    }

    @Test
    fun allowsAnEmptyBodyOnlyWhenMediaIsDescribed() {
        accepted(mapOf("text" to "", "media" to media(item("kind" to "gif"))))
        assertContains(rejected(mapOf("text" to "   ")), "empty")
    }

    @Test
    fun rejectsInvalidNestedHostileAndOversizedSnapshots() {
        assertTrue(SnapshotParser.parse("{") is ParseResult.Failed)
        assertTrue(SnapshotParser.parse("[]") is ParseResult.Failed)
        assertContains(rejected(extra = mapOf("version" to 2)), "version must be 1")
        val nested = quote("quote" to quote())
        assertContains(rejected(mapOf("quote" to nested)), "another quote")
        assertContains(rejected(mapOf("sourceUrl" to "javascript:alert(1)")), "sourceUrl")
        rejected(mapOf("sourceUrl" to "https://x.com.evil.com/ada_example/status/1"))
        assertContains(rejected(mapOf("media" to media(item("kind" to "photo", "src" to "https://pbs.twimg.com/media/a.jpg")))), "does not load")
        rejected(mapOf("authorHandle" to "has space"))
        assertContains(rejected(mapOf("text" to "a".repeat(Limits.MAX_TEXT + 1))), "12,000")
        val oversize = SnapshotParser.parse(" ".repeat(Limits.MAX_BYTES + 1))
        assertContains((oversize as ParseResult.Failed).error, "48 KB")
    }

    @Test
    fun stripsControlCharactersAndBidiOverridesFromTheName() {
        val snapshot = accepted(mapOf("authorName" to "Ada‮\u0000 Example", "text" to "Keep\u0000this"))
        assertEquals("Ada Example", snapshot.post.authorName)
        assertEquals("Keepthis", snapshot.post.text)
    }

    @Test
    fun keepsAFullProfileOnThePostAndTheQuote() {
        val avatar = "data:image/webp;base64,UklGRhIAAABXRUJQVlA4TAYAAAAvAAAAAA=="
        val snapshot = accepted(mapOf(
            "profile" to JSONObject().put("avatar", avatar).put("bio", "Distributed systems.\nCoffee.").put("location", "Tokyo")
                .put("website", "https://example.com/ada").put("joinedAt", "2014-03").put("followers", 12_400)
                .put("following", 318).put("posts", 9_001).put("verified", true).put("tracking", "drop me"),
            "quote" to quote("profile" to JSONObject().put("bio", "Poet").put("joinedAt", "2020-01-02")),
        ))
        assertEquals(
            Profile(avatar, "Distributed systems.\nCoffee.", "Tokyo", "https://example.com/ada", "2014-03", 12_400, 318, 9_001, true),
            snapshot.post.profile,
        )
        assertEquals(Profile(bio = "Poet", joinedAt = "2020-01-02"), snapshot.post.quote?.profile)
        assertContains(SnapshotJson.canonical(snapshot), "\"followers\":12400")
        assertFalse(SnapshotJson.canonical(snapshot).contains("tracking"))
    }

    @Test
    fun dropsAnEmptyProfileAndAFalseVerifiedFlag() {
        assertNull(accepted(mapOf("profile" to JSONObject().put("bio", "  ").put("verified", false))).post.profile)
    }

    @Test
    fun rejectsABadProfile() {
        val cases = listOf(
            JSONObject().put("avatar", "https://pbs.twimg.com/profile_images/1/a.jpg") to "avatar",
            JSONObject().put("avatar", "data:image/svg+xml;base64,PHN2Zz4=") to "avatar",
            JSONObject().put("avatar", "data:image/png;base64,${"A".repeat(Limits.MAX_AVATAR)}") to "avatar",
            JSONObject().put("website", "javascript:alert(1)") to "website",
            JSONObject().put("website", "http://example.com") to "website",
            JSONObject().put("website", "https://user:pw@example.com") to "website",
            JSONObject().put("joinedAt", "March 2014") to "joinedAt",
            JSONObject().put("followers", -1) to "followers",
            JSONObject().put("followers", 1.5) to "followers",
            JSONObject().put("following", "318") to "following",
            JSONObject().put("verified", "yes") to "verified",
            JSONObject().put("bio", "a".repeat(Limits.MAX_BIO + 1)) to "bio",
            "nope" to "profile",
        )
        for ((profile, field) in cases) assertContains(rejected(mapOf("profile" to profile)), field, profile.toString().take(60))
    }

    @Test
    fun neverThrowsOnAnyStringOrSnapshot() {
        Gen.forAll(500, seed = 8, gen = { random ->
            when (random.nextInt(3)) {
                0 -> Gen.binaryString(random, 200)
                1 -> Gen.rawSnapshot(random)
                else -> Gen.rawSnapshot(random).let { it.substring(0, random.nextInt(it.length)) }
            }
        }) { text ->
            val parsed = SnapshotParser.parse(text)
            if (parsed is ParseResult.Failed) assertTrue(parsed.error.isNotEmpty())
        }
    }

    @Test
    fun acceptsMostGeneratedSnapshotsSoThePropertiesAreNotVacuous() {
        val random = kotlin.random.Random(9)
        val ok = (1..300).count { SnapshotParser.parse(Gen.rawSnapshot(random)) is ParseResult.Ok }
        assertTrue("only $ok of 300 accepted", ok > 150)
    }

    @Test
    fun isAFixedPointThroughCanonicalAndPrettyJson() {
        Gen.forAll(400, seed = 10, gen = Gen::rawSnapshot) { raw ->
            val first = SnapshotParser.parse(raw) as? ParseResult.Ok ?: return@forAll
            assertEquals(first, SnapshotParser.parse(SnapshotJson.canonical(first.snapshot)))
            assertEquals(first, SnapshotParser.parse(SnapshotJson.pretty(first.snapshot)))
        }
    }

    @Test
    fun keepsHostileBodyTextExactlyAsText() {
        for (text in listOf(
            "<script>alert(1)</script>",
            "<img src=x onerror=alert(1)>",
            "javascript:alert(1)",
            "\"},\"example\":true,\"x\":{\"",
            "‮evil‬",
            "line\nbreak\n\nparagraph",
            "a b c",
            "café 日本語 🌳 👩🏽‍💻",
        )) assertEquals(text, accepted(mapOf("text" to text)).post.text)
    }

    @Test
    fun doesNotLetProtoKeysSupplyFields() {
        assertEquals(
            ParseResult.Failed("post is missing."),
            SnapshotParser.parse("""{"format":"single-post-snapshot","version":1,"__proto__":{"post":{"authorName":"A","authorHandle":"a","text":"t"}}}"""),
        )
        assertTrue(SnapshotParser.parse("""{"format":"single-post-snapshot","version":1,"post":{"__proto__":{"authorName":"A","authorHandle":"a","text":"t"}}}""") is ParseResult.Failed)
    }

    @Test
    fun dropsFieldsItDoesNotKnow() {
        val out = SnapshotJson.canonical(accepted(mapOf("tracking" to "nope", "media" to media(item("kind" to "photo", "extra" to 1))), mapOf("tracking" to "nope")))
        assertFalse(out.contains("tracking"))
        assertFalse(out.contains("extra"))
    }

    @Test
    fun measuresNamesInUtf16UnitsAfterCleaning() {
        assertEquals(50, accepted(mapOf("authorName" to "a".repeat(50))).post.authorName.length)
        assertContains(rejected(mapOf("authorName" to "a".repeat(51))), "longer than 50")
        assertEquals(50, accepted(mapOf("authorName" to "  ${"a".repeat(50)}  ")).post.authorName.length)
        assertContains(rejected(mapOf("authorName" to "🌳".repeat(26))), "longer than 50")
        assertEquals("Ada Lovelace", accepted(mapOf("authorName" to "Ada\t\n  Lovelace")).post.authorName)
        assertContains(rejected(mapOf("authorName" to "‮\u0000 ")), "empty")
        assertContains(rejected(mapOf("authorName" to 5)), "must be text")
    }

    @Test
    fun acceptsHandlesWithOneAtSignAndTheDocumentedCharactersOnly() {
        assertEquals("ada_1", accepted(mapOf("authorHandle" to "@ada_1")).post.authorHandle)
        assertEquals(15, accepted(mapOf("authorHandle" to "a".repeat(15))).post.authorHandle.length)
        for (handle in listOf("", "@", "@@ada", "a".repeat(16), "ada-1", "ada.1", "ａｄａ", "adá")) {
            assertContains(rejected(mapOf("authorHandle" to handle)), "authorHandle", handle)
        }
    }

    @Test
    fun countsTextAfterNewlineNormalizationAndControlStripping() {
        assertEquals(12_000, accepted(mapOf("text" to "a".repeat(12_000))).post.text.length)
        assertEquals(11_999, accepted(mapOf("text" to "a\r\n".repeat(6_000))).post.text.length)
        assertEquals(12_000, accepted(mapOf("text" to "${"a".repeat(12_000)}\u0000\u0001")).post.text.length)
        assertContains(rejected(mapOf("text" to "a".repeat(12_001))), "12,000")
        assertContains(rejected(mapOf("text" to Absent)), "missing")
        assertContains(rejected(mapOf("text" to null)), "must be text")
    }

    @Test
    fun allowsFourMediaItemsAndAltTextUpTo1000Characters() {
        val four = (1..4).map { item("kind" to "audio", "alt" to "a".repeat(1_000)) }
        assertEquals(4, accepted(mapOf("media" to JSONArray(four))).post.media.size)
        assertContains(rejected(mapOf("media" to JSONArray(four + item("kind" to "photo")))), "at most 4")
        assertContains(rejected(mapOf("media" to media(item("kind" to "photo", "alt" to "a".repeat(1_001))))), "1,000")
        assertContains(rejected(mapOf("media" to media(item("kind" to "image")))), "kind must be")
        assertContains(rejected(mapOf("media" to JSONObject())), "must be an array")
        assertContains(rejected(mapOf("media" to JSONArray().put(JSONObject.NULL))), "must be a JSON object")
        assertEquals(listOf(Media(MediaKind.PHOTO)), accepted(mapOf("media" to media(item("kind" to "photo", "alt" to "   ")))).post.media)
    }

    @Test
    fun rejectsEveryMediaUrlKeyUnlessItIsNull() {
        for (key in listOf("url", "src", "href", "source", "previewUrl", "poster")) {
            assertContains(rejected(mapOf("media" to media(item("kind" to "photo", key to "https://example.com/a.jpg")))), "cannot include a URL", key)
            assertContains(rejected(mapOf("media" to media(item("kind" to "photo", key to "")))), "cannot include a URL", key)
            assertEquals(listOf(Media(MediaKind.PHOTO)), accepted(mapOf("media" to media(item("kind" to "photo", key to null)))).post.media)
        }
    }

    @Test
    fun measuresTheWholeInputInUtf8BytesWithoutTheBom() {
        val base = build(mapOf("text" to "x"))
        val exact = base + " ".repeat(Limits.MAX_BYTES - base.toByteArray().size)
        assertEquals(Limits.MAX_BYTES, exact.toByteArray().size)
        assertTrue(SnapshotParser.parse(exact) is ParseResult.Ok)
        assertTrue(SnapshotParser.parse("﻿$exact") is ParseResult.Ok)
        assertTrue(SnapshotParser.parse("$exact ") is ParseResult.Failed)
    }

    @Test
    fun checksTheLanguageTagAndCreatedAtShape() {
        assertEquals("pt-BR", accepted(mapOf("lang" to " pt-BR ")).post.lang)
        for (lang in listOf("e", "english", "en_US", "en-", "<b>", "")) assertContains(rejected(mapOf("lang" to lang)), "lang", lang)
        assertEquals("2026-04-02T16:30:00+09:00", accepted(mapOf("createdAt" to " 2026-04-02T16:30:00+09:00 ")).post.createdAt)
        for (createdAt in listOf("2026-04-02", "2026-04-02 16:30:00Z", "2026-04-02T16:30Z", "2026-13-02T16:30:00Z", "", 1712075400000L)) {
            assertContains(rejected(mapOf("createdAt" to createdAt)), "createdAt", createdAt.toString())
        }
    }

    @Test
    fun requiresFormatVersion1AsANumberAndABooleanExample() {
        assertEquals(ParseResult.Failed("version must be 1."), SnapshotParser.parse("""{"format":"single-post-snapshot","version":"1","post":{}}"""))
        assertEquals(ParseResult.Failed("format must be single-post-snapshot."), SnapshotParser.parse("""{"format":"other","version":1,"post":{}}"""))
        assertContains(rejected(extra = mapOf("example" to "yes")), "example")
        assertFalse(accepted(extra = mapOf("example" to false)).example)
        assertContains(rejected(mapOf("quote" to null)), "quote must be a JSON object")
        assertEquals(ParseResult.Failed("A snapshot must be a JSON object."), SnapshotParser.parse("null"))
    }

    @Test
    fun acceptsAnAvatarDataUriUpTo20000CharactersAndRejectsRemoteOrOddOnes() {
        val png = "data:image/png;base64,iVBORw0KGgo="
        val body = "A".repeat(Limits.MAX_AVATAR - "data:image/png;base64,".length)
        assertEquals(20_000, accepted(mapOf("profile" to JSONObject().put("avatar", "data:image/png;base64,$body"))).post.profile?.avatar?.length)
        assertContains(rejected(mapOf("profile" to JSONObject().put("avatar", "data:image/png;base64,${body}A"))), "20,000")
        for (avatar in listOf(
            "https://pbs.twimg.com/profile_images/a.jpg",
            "data:image/svg+xml;base64,PHN2Zz4=",
            "data:image/png,rawdata",
            "data:image/gif;base64,R0lGOD==",
            "data:image/png;base64,",
            "data:image/png;base64,abc===",
            "data:image/png;base64,ab cd",
            "javascript:alert(1)",
        )) assertContains(rejected(mapOf("profile" to JSONObject().put("avatar", avatar))), "avatar", avatar)
        assertEquals(png, accepted(mapOf("profile" to JSONObject().put("avatar", " $png "))).post.profile?.avatar)
    }

    @Test
    fun keepsBioLineBreaksFlattensLocationAndEnforcesBothLengths() {
        val profile = accepted(mapOf("profile" to JSONObject().put("bio", "one\r\ntwo").put("location", "Tokyo\n‮Japan"))).post.profile
        assertEquals(Profile(bio = "one\ntwo", location = "Tokyo Japan"), profile)
        assertContains(rejected(mapOf("profile" to JSONObject().put("bio", "a".repeat(501)))), "bio")
        assertContains(rejected(mapOf("profile" to JSONObject().put("location", "a".repeat(101)))), "location")
        assertNull(accepted(mapOf("profile" to JSONObject().put("bio", "  ").put("location", ""))).post.profile)
    }

    @Test
    fun onlyAcceptsPlainHttpsWebsites() {
        assertEquals("https://example.com/a?b=c", accepted(mapOf("profile" to JSONObject().put("website", "https://example.com/a?b=c"))).post.profile?.website)
        for (website in listOf(
            "http://example.com",
            "javascript:alert(1)",
            "https://user@example.com",
            "https://example.com:8080",
            "https://exa mple.com",
            "https://example.com\\@evil",
            "https://example.com/${"a".repeat(300)}",
            "example.com",
        )) assertContains(rejected(mapOf("profile" to JSONObject().put("website", website))), "website", website)
    }

    @Test
    fun acceptsTheDocumentedJoinedAtForms() {
        for (joinedAt in listOf("2014-03", "2014-03-21", "2014-03-21T10:00:00Z", "2014-03-21T10:00:00.5+09:00")) {
            assertEquals(joinedAt, accepted(mapOf("profile" to JSONObject().put("joinedAt", joinedAt))).post.profile?.joinedAt)
        }
        for (joinedAt in listOf("2014", "2014-3", "2014-13", "March 2014", "2014-03-21T10:00", "")) {
            assertContains(rejected(mapOf("profile" to JSONObject().put("joinedAt", joinedAt))), "joinedAt", joinedAt)
        }
    }

    @Test
    fun acceptsWholeCountsFrom0To1e12Only() {
        assertEquals(
            Profile(followers = 0, following = 1_000_000_000_000, posts = 5),
            accepted(mapOf("profile" to JSONObject().put("followers", 0).put("following", 1e12).put("posts", 5))).post.profile,
        )
        for (followers in listOf<Any?>(-1, 1.5, 1e12 + 1, "10", true, null)) {
            assertContains(rejected(mapOf("profile" to JSONObject().put("followers", followers ?: JSONObject.NULL))), "whole number", followers.toString())
        }
        assertTrue(SnapshotParser.parse(build().replace("\"text\":\"Hello\"", "\"text\":\"Hello\",\"profile\":{\"posts\":1e400}")) is ParseResult.Failed)
    }

    @Test
    fun dropsANullProfileAndRejectsOtherNonObjects() {
        assertNull(accepted(mapOf("profile" to null)).post.profile)
        assertContains(rejected(mapOf("profile" to JSONArray())), "profile must be a JSON object")
        assertContains(rejected(mapOf("profile" to "x")), "profile must be a JSON object")
        assertContains(rejected(mapOf("profile" to JSONObject().put("verified", "true"))), "verified")
    }

    @Test
    fun theExampleParsesToItself() {
        assertEquals(ParseResult.Ok(Example.snapshot), SnapshotParser.parse(SnapshotJson.canonical(Example.snapshot)))
    }

    @Test
    fun rejectsCreatedAtDaysAndHoursThatDoNotExist() {
        for (createdAt in listOf("2026-02-29T10:00:00Z", "2026-02-30T10:00:00Z", "2026-04-31T10:00:00Z", "2026-01-01T24:00:00Z")) {
            assertContains(rejected(mapOf("createdAt" to createdAt)), "createdAt", createdAt)
            assertContains(rejected(mapOf("quote" to quote("createdAt" to createdAt))), "createdAt", createdAt)
        }
        assertEquals("2024-02-29T23:59:59.999Z", accepted(mapOf("createdAt" to "2024-02-29T23:59:59.999Z")).post.createdAt)
    }

    @Test
    fun rejectsJoinedAtDaysThatDoNotExist() {
        for (joinedAt in listOf("2014-02-30", "2014-06-31", "2014-02-30T10:00:00Z")) {
            assertContains(rejected(mapOf("profile" to JSONObject().put("joinedAt", joinedAt))), "joinedAt", joinedAt)
        }
        assertEquals("2016-02-29", accepted(mapOf("profile" to JSONObject().put("joinedAt", "2016-02-29"))).post.profile?.joinedAt)
    }

    @Test
    fun acceptsEveryRealInstantWrittenByToIsoString() {
        val format = java.time.format.DateTimeFormatter.ofPattern("uuuu-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(java.time.ZoneOffset.UTC)
        Gen.forAll(500, seed = 11, gen = { random ->
            format.format(java.time.Instant.ofEpochMilli(random.nextLong(-30_610_224_000_000L, 253_402_300_799_000L)))
        }) { createdAt -> assertEquals(createdAt, accepted(mapOf("createdAt" to createdAt)).post.createdAt) }
    }

    @Test
    fun importReadsASnapshotWithABomAndSurroundingWhitespace() {
        assertTrue(Importer.open("﻿ \n${SnapshotJson.canonical(Example.snapshot)}\n ") is Opened.Post)
    }

    @Test
    fun importTreatsABareAddressAsUrlOnlyAndSaysWhetherItIsX() {
        assertEquals(Opened.UrlOnly("https://x.com/a/status/1", true), Importer.open("https://x.com/a/status/1"))
        assertEquals(Opened.UrlOnly("twitter.com/a/status/1", true), Importer.open("twitter.com/a/status/1"))
        assertEquals(true, (Importer.open("https://t.co/abc") as Opened.UrlOnly).x)
        assertEquals(Opened.UrlOnly("https://example.com/post", false), Importer.open("  https://example.com/post  "))
        assertEquals(Opened.UrlOnly("https://example.com/essay", false), Importer.open("https://example.com/essay"))
    }

    @Test
    fun importExplainsEmptyAndInvalidInput() {
        assertEquals(Opened.Invalid("Paste a snapshot first."), Importer.open(""))
        assertEquals(Opened.Invalid("Paste a snapshot first."), Importer.open("﻿   "))
        assertEquals(Opened.Invalid("Paste a snapshot first."), Importer.open("  "))
        assertTrue(Importer.open("{}") is Opened.Invalid)
    }

    @Test
    fun importNeverThrowsAndAlwaysReturnsOneOfThreeKinds() {
        Gen.forAll(500, seed = 12, gen = { random ->
            when (random.nextInt(3)) {
                0 -> Gen.binaryString(random, 100)
                1 -> Gen.webUrl(random)
                else -> JSONObject().put("a", Gen.binaryString(random, 10)).toString()
            }
        }) { text ->
            val opened = Importer.open(text)
            if (opened is Opened.Invalid) assertTrue(opened.error.isNotEmpty())
        }
    }
}
