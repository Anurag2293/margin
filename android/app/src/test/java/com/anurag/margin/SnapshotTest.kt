package com.anurag.margin

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SnapshotTest {
    private val webToken = "ZVBNitRAFL5K-NaVpBJbkQLRGRBcqCgogo5ITerFLk3qxaoXu6Fp8AAuB9yIrlwobjyDN3ExuJwjDDUztovevu99vxv0HEcrMEg-vB6onDhJmYKd0pIFCu8pJs8BplHIGMwGdpYlx4d2JBgcOFs8qIq7aztOA0FdofdscEPG71hnX9EOFVpnt_s-UMGBirOvH38dhaNw-unb6eeff398Kf58OCk62__-XixFpmTq-opddTzWttqdpeq4XkOhi2SF3EEWbnV7o9RN2Vx_0tw0emG0rrTWz6GQeI4dPY0DDP5pjHzsB6pk5UUoXjr8z1snsTKnetHW05KF6-Z2utVqKEyRe5_7bXDsGQaHnqHQ8zDwimKCadqF1hf7-d6Tg5E4k8Ib9mEXtVmU-hq2Cu9mFtqb9nG-uuIRk-zvOjHJ_q6XlCw5kvMW5sUGb31wmZAbZJ0hPz7zwfEK25fb7Tk"

    private fun snapshot(post: String) =
        """{"format":"single-post-snapshot","version":1,"post":{"authorName":"Ada","authorHandle":"ada",$post}}"""

    private fun ok(result: ParseResult): Snapshot {
        assertTrue("expected ok, got $result", result is ParseResult.Ok)
        return (result as ParseResult.Ok).snapshot
    }

    private fun failed(result: ParseResult): String {
        assertTrue("expected failure, got $result", result is ParseResult.Failed)
        return (result as ParseResult.Failed).error
    }

    @Test
    fun decodesATokenMadeByNodeZlib() {
        val post = ok(Share.decode(webToken)).post
        assertEquals("ada_example", post.authorHandle)
        assertEquals("Line one 🌱\n\n日本語 — café https://example.com/a. https://t.co/x", post.text)
        assertEquals("https://twitter.com/ada_example/status/42", post.sourceUrl)
        assertEquals(12_400L, post.profile?.followers)
        assertEquals(true, post.profile?.verified)
        assertEquals("Quoted Poet", post.quote?.authorName)
        assertEquals(MediaKind.PHOTO, post.media.single().kind)
    }

    @Test
    fun roundTripsThroughAReaderLink() {
        val original = ok(Share.decode(webToken))
        val link = Share.link(original)!!
        assertTrue(link.startsWith("https://margin-eight-fawn.vercel.app/#s1."))
        assertEquals(original, ok(Share.decode(Share.tokenFromLink(link)!!)))
    }

    @Test
    fun opensLinksFromSharedText() {
        val text = "Julius: read this https://margin-eight-fawn.vercel.app/#s1.$webToken today"
        assertTrue(Importer.open(text) is Opened.Post)
        assertTrue(Importer.open("https://x.com/someone/status/1") is Opened.UrlOnly)
        assertNull(Share.tokenFromLink("https://evil.example/#s1.$webToken"))
    }

    @Test
    fun rejectsBadInput() {
        assertTrue(failed(SnapshotParser.parse("{")).contains("not valid JSON"))
        assertTrue(failed(SnapshotParser.parse(snapshot("\"text\":\"a\",\"sourceUrl\":\"javascript:alert(1)\""))).contains("sourceUrl"))
        assertTrue(failed(SnapshotParser.parse(snapshot("\"text\":\"a\",\"media\":[{\"kind\":\"photo\",\"url\":\"https://pbs.twimg.com/a.jpg\"}]"))).contains("URL"))
        assertTrue(failed(SnapshotParser.parse(snapshot("\"text\":\"a\",\"profile\":{\"avatar\":\"https://pbs.twimg.com/a.jpg\"}"))).contains("avatar"))
        assertTrue(failed(SnapshotParser.parse(snapshot("\"text\":\"a\",\"profile\":{\"followers\":1.5}"))).contains("followers"))
        assertTrue(failed(SnapshotParser.parse(snapshot("\"text\":\"a\",\"profile\":{\"website\":\"http://example.com\"}"))).contains("website"))
        assertTrue(failed(Share.decode("!!!")).contains("characters"))
        assertTrue(failed(SnapshotParser.parse(snapshot("\"text\":\"${"a".repeat(12_001)}\""))).contains("12,000"))
    }

    @Test
    fun linkifyKeepsXAsText() {
        val parts = Linkify.split("See https://example.com/a. and https://x.com/b and https://user@example.com")
        assertEquals(TextPart.Link("https://example.com/a", "https://example.com/a"), parts[1])
        assertEquals(TextPart.Plain("."), parts[2])
        assertEquals(listOf(TextPart.Blocked("https://x.com/b")), parts.filterIsInstance<TextPart.Blocked>())
        assertTrue(parts.none { it is TextPart.Link && it.href.contains("user@") })
    }
}
