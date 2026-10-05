import * as React from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import {
  Clock,
  Calendar,
  ArrowLeft,
  Share2,
  CheckCircle2,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import { SeoHead } from '../../components/seo/SeoHead';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { CTASection } from '../../components/marketing/CTASection';
import { BLOG_POSTS_DATA } from '../../domains/marketing/data/blogPosts';

export function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const post = BLOG_POSTS_DATA.find((p) => p.slug === slug);

  if (!post) {
    return <Navigate to="/blog" replace />;
  }

  const related = BLOG_POSTS_DATA.filter((p) => p.slug !== slug).slice(0, 2);

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Article link copied to clipboard!');
    }
  };

  return (
    <>
      <SeoHead
        title={`${post.title} | Orvio Blog`}
        description={post.excerpt}
        ogType="article"
        ogImage={post.coverImage}
        keywords={post.tags}
      />

      <article className="space-y-16 py-12">
        {/* Article Header */}
        <header className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-6">
          <Link
            to="/blog"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to All Articles</span>
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="primary">{post.category}</Badge>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {post.publishedAt}
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {post.readTime}
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            {post.title}
          </h1>

          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            {post.excerpt}
          </p>

          <div className="flex items-center justify-between pt-6 border-t border-slate-200">
            <div className="flex items-center gap-3">
              <img
                src={post.author.avatar}
                alt={post.author.name}
                className="h-11 w-11 rounded-full object-cover ring-2 ring-indigo-500/20"
              />
              <div>
                <h3 className="text-sm font-bold text-slate-900">{post.author.name}</h3>
                <p className="text-xs text-slate-500">{post.author.role}</p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
              className="text-xs gap-1.5"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>Share</span>
            </Button>
          </div>
        </header>

        {/* Featured Cover Image */}
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-3xl shadow-lg border border-slate-200">
            <img
              src={post.coverImage}
              alt={post.title}
              className="w-full h-80 sm:h-[420px] object-cover"
            />
          </div>
        </div>

        {/* Markdown Article Body */}
        <section className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="prose prose-slate prose-lg max-w-none prose-headings:font-bold prose-headings:text-slate-900 prose-p:text-slate-700 prose-p:leading-relaxed prose-a:text-indigo-600 prose-code:bg-slate-100 prose-code:p-1 prose-code:rounded prose-code:text-indigo-700 prose-pre:bg-slate-950 prose-pre:text-slate-100">
            <ReactMarkdown>{post.content}</ReactMarkdown>
          </div>

          {/* Tags */}
          <div className="mt-12 pt-6 border-t border-slate-200 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Related Tags:</span>
            {post.tags.map((t) => (
              <Badge key={t} variant="secondary" className="text-xs">
                #{t}
              </Badge>
            ))}
          </div>
        </section>

        {/* Related Posts */}
        {related.length > 0 && (
          <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pt-12 border-t border-slate-200">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                Recommended Next Reads
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {related.map((r) => (
                <Link key={r.id} to={`/blog/${r.slug}`} className="group block">
                  <div className="p-6 rounded-2xl border border-slate-200 bg-white card-glow space-y-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {r.category}
                    </Badge>
                    <h4 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                      {r.title}
                    </h4>
                    <p className="text-xs text-slate-600 line-clamp-2">{r.excerpt}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <CTASection
          title="Put These Insights to Work in Your Business"
          subtitle="Try Orvio Hub free for 14 days and see real operational transformation."
        />
      </article>
    </>
  );
}
