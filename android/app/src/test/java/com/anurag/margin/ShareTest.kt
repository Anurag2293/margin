package com.anurag.margin

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.ByteArrayOutputStream
import java.util.Base64
import java.util.zip.Deflater

/** Ports src/lib/share.test.ts and share.properties.test.ts onto Share.decode, Share.link, and Share.tokenFromLink. */
class ShareTest {
    private fun deflate(bytes: ByteArray, level: Int = Deflater.DEFAULT_COMPRESSION): String {
        val deflater = Deflater(level, true)
        deflater.setInput(bytes)
        deflater.finish()
        val out = ByteArrayOutputStream()
        val buffer = ByteArray(8192)
        while (!deflater.finished()) out.write(buffer, 0, deflater.deflate(buffer))
        deflater.end()
        return Base64.getUrlEncoder().withoutPadding().encodeToString(out.toByteArray())
    }

    private fun deflate(text: String, level: Int = Deflater.DEFAULT_COMPRESSION) = deflate(text.toByteArray(Charsets.UTF_8), level)

    private fun failed(result: ParseResult): String {
        assertTrue("expected failure, got $result", result is ParseResult.Failed)
        return (result as ParseResult.Failed).error
    }

    private fun accepted(random: kotlin.random.Random): Snapshot {
        while (true) {
            val parsed = SnapshotParser.parse(Gen.rawSnapshot(random))
            if (parsed is ParseResult.Ok) return parsed.snapshot
        }
    }

    @Test
    fun decodesEveryLinkedSnapshotBackToTheSameSnapshot() {
        Gen.forAll(150, seed = 13, gen = ::accepted) { snapshot ->
            val link = Share.link(snapshot)!!
            val token = Share.tokenFromLink(link)!!
            assertTrue(token.length <= Limits.MAX_TOKEN)
            assertTrue(Regex("^[A-Za-z0-9_-]+$").matches(token))
            assertEquals(ParseResult.Ok(snapshot), Share.decode(token))
        }
    }

    @Test
    fun readsTokensFromOtherRawDeflateProducersAtAnyLevel() {
        Gen.forAll(60, seed = 14, gen = { random -> accepted(random) to random.nextInt(0, 10) }) { (snapshot, level) ->
            assertEquals(ParseResult.Ok(snapshot), Share.decode(deflate(SnapshotJson.canonical(snapshot), level)))
        }
    }

    @Test
    fun keepsLoneSurrogatesThroughJsonAndReaderLinks() {
        val snapshot = Snapshot(Post(authorName = "A", authorHandle = "a", text = "a\uD800b\uDFFFc 🌳 \uDBFF"))
        val json = SnapshotJson.canonical(snapshot)
        assertTrue(json, json.contains("a\\ud800b\\udfffc 🌳 \\udbff"))
        assertEquals(ParseResult.Ok(snapshot), SnapshotParser.parse(SnapshotJson.pretty(snapshot)))
        assertEquals(ParseResult.Ok(snapshot), Share.decode(Share.tokenFromLink(Share.link(snapshot)!!)!!))
    }

    @Test
    fun readsATokenWithExtraJsonWhitespaceAndUnknownFields() {
        val pretty = """
            {
              "post": { "text": "Line one 🌱\n\n日本語 — café", "authorHandle": "ada_example", "authorName": "Ada M. Example" },
              "version": 1,
              "format": "single-post-snapshot",
              "tracking": "nope"
            }
        """.trimIndent()
        val decoded = Share.decode(deflate(pretty)) as ParseResult.Ok
        assertTrue(decoded.snapshot.post.text.contains("日本語"))
        assertTrue(!SnapshotJson.canonical(decoded.snapshot).contains("tracking"))
    }

    @Test
    fun neverThrowsOnArbitraryTextBytesOrDamagedTokens() {
        val valid = deflate(SnapshotJson.canonical(accepted(kotlin.random.Random(3))))
        Gen.forAll(300, seed = 15, gen = { random ->
            when (random.nextInt(5)) {
                0 -> Gen.binaryString(random, 300)
                1 -> (0 until random.nextInt(300)).map { "ABCabc019-_".random(random) }.joinToString("")
                2 -> Base64.getUrlEncoder().withoutPadding().encodeToString(random.nextBytes(random.nextInt(400)))
                3 -> valid.substring(0, random.nextInt(valid.length + 1))
                else -> random.nextInt(valid.length).let { at -> valid.substring(0, at) + "AZaz09-_".random(random) + valid.substring(at + 1) }
            }
        }) { token ->
            val result = Share.decode(token)
            if (result is ParseResult.Failed) assertTrue(result.error.isNotEmpty())
        }
    }

    @Test
    fun explainsEachKindOfBadToken() {
        assertEquals(ParseResult.Failed("This reader link is empty."), Share.decode(""))
        assertEquals(ParseResult.Failed("This reader link contains characters Margin does not use."), Share.decode("abc="))
        assertTrue(failed(Share.decode("abc+/")).contains("characters"))
        assertTrue(failed(Share.decode("%%%")).contains("characters"))
        assertEquals(ParseResult.Failed("This reader link could not be decoded."), Share.decode("a"))
        failed(Share.decode("AAAA"))
        failed(Share.decode(deflate("not json")))
        assertEquals(ParseResult.Failed("This reader link did not contain text."), Share.decode(deflate(byteArrayOf(0xff.toByte(), 0xfe.toByte(), 0xc3.toByte(), 0x28))))
        assertEquals(ParseResult.Failed("A snapshot must be a JSON object."), Share.decode(deflate("[1,2]")))
        val valid = deflate(SnapshotJson.canonical(accepted(kotlin.random.Random(5))))
        failed(Share.decode(valid.dropLast(6)))
        assertTrue(failed(Share.decode("a".repeat(Limits.MAX_TOKEN + 1))).contains("too long"))
    }

    @Test
    fun stopsUnpackingAt48KbEvenForATinyToken() {
        val bomb = deflate(ByteArray(10 * 1024 * 1024) { 0x20 })
        assertTrue(bomb.length < Limits.MAX_TOKEN)
        assertTrue(failed(Share.decode(bomb)).contains("unpacks to more than 48 KB"))
        val exact = deflate(ByteArray(Limits.MAX_BYTES) { 0x20 })
        assertEquals(ParseResult.Failed("This is not valid JSON."), Share.decode(exact))
    }

    @Test
    fun refusesToLinkASnapshotWhoseLinkWouldBeTooLong() {
        var seed = 1L
        val text = buildString {
            repeat(11_000) {
                seed = (seed * 48271) % 2147483647
                appendCodePoint(0x4e00 + (seed % 20_000).toInt())
            }
        }
        val snapshot = Snapshot(Post(authorName = "A", authorHandle = "a", text = text))
        assertTrue(SnapshotJson.canonical(snapshot).toByteArray().size <= Limits.MAX_BYTES)
        assertNull(Share.link(snapshot))
        val over = snapshot.copy(post = snapshot.post.copy(text = "日".repeat(12_000), quote = Post(authorName = "Q", authorHandle = "q", text = "日".repeat(5_000))))
        assertNull(Share.link(over))
    }

    @Test
    fun readsTheTokenFromAReaderLinkFragment() {
        val cases = listOf(
            "" to null,
            "#" to null,
            "#s1." to "",
            "#s1.abc" to "abc",
            "#%73%31.abc" to "abc",
            "#s1.ab%2Dc" to "ab-c",
            "#s1.%E0%A4%A" to "%E0%A4%A",
            "#S1.abc" to null,
            "#s2.abc" to null,
            "#content" to null,
            "#https%3A%2F%2Fx.com%2Fa%2Fstatus%2F1" to null,
        )
        for ((hash, token) in cases) assertEquals(hash, token, Share.tokenFromLink("${Share.ORIGIN}/$hash"))
    }

    @Test
    fun readingALinkNeverThrows() {
        Gen.forAll(1_000, seed = 16, gen = { "${Share.ORIGIN}/#" + Gen.binaryString(it, 80) }) { Share.tokenFromLink(it) }
    }
}
