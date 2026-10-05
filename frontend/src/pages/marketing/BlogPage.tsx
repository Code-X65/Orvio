import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Search,
  Clock,
  ArrowRight,
  Sparkles,
  Tag,
} from 'lucide-react';
import { SeoHead } from '../../components/seo/SeoHead';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Card, CardContent } from '../../components/ui/card';
import { BLOG_POSTS_DATA } from '../../domains/marketing/data/blogPosts';
import type { BlogPost } from '../../domains/marketing/types';

export function BlogPage() {
  const [activeCategory, setActiveCategory] = React.useState<string>('All');
  const [searchQuery, setSearchQuery] = React.useState<string>('');

  const categories = ['All', 'Inventory Tips', 'Gym Management', 'SME Growth'];

  const filteredPosts = BLOG_POSTS_DATA.filter((post) => {
    const matchesCategory =
      activeCategory === 'All' || post.category === activeCategory;
    const matchesSearch =
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesCategory && matchesSearch;
  });

  const featured = BLOG_POSTS_DATA[0];

  return (
    <>
      <SeoHead
        title="Blog & Nigerian SME Growth Playbooks | Orvio Hub"
        description="Practical retail management guides, inventory loss reduction tactics, gym retention frameworks, and African tech insights from the Orvio team."
        keywords={['Nigerian business blog', 'Retail management tips', 'Gym retention guide Lagos', 'POS best practices']}
      />

      <div className="space-y-16 py-12">
        {/* Blog Hero */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <Badge variant="glow" className="mb-4">
            <BookOpen className="h-3.5 w-3.5 mr-1" />
            Insights & Playbooks
          </Badge>
          <h1 className="text-4xl sm:text-6xl font-black text-slate-900 tracking-tight max-w-4xl mx-auto leading-tight">
            The Orvio <span className="gradient-text">Business Dispatch</span>
          </h1>
          <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Tactical playbooks, inventory optimization guides, and growth strategies for modern Nigerian retail, pharmacies, and gym owners.
          </p>

          {/* Search Bar & Category Filter */}
          <div className="mt-10 max-w-2xl mx-auto flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3.5 top-3.5 text-slate-400" />
              <Input
                placeholder="Search articles by keyword, topic, or tag..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeCategory === cat
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </section>

        {/* Featured Post (if All or category matches) */}
        {activeCategory === 'All' && !searchQuery && (
          <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Link to={`/blog/${featured.slug}`} className="group block">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-10 shadow-sm card-glow">
                <div className="lg:col-span-6 overflow-hidden rounded-2xl">
                  <img
                    src={featured.coverImage}
                    alt={featured.title}
                    className="w-full h-64 sm:h-80 object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="lg:col-span-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="primary">Featured Playbook</Badge>
                    <Badge variant="secondary">{featured.category}</Badge>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {featured.readTime}
                    </span>
                  </div>

                  <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 group-hover:text-indigo-600 transition-colors leading-tight">
                    {featured.title}
                  </h2>

                  <p className="text-sm text-slate-600 leading-relaxed">
                    {featured.excerpt}
                  </p>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img
                        src={featured.author.avatar}
                        alt={featured.author.name}
                        className="h-9 w-9 rounded-full object-cover ring-2 ring-indigo-500/20"
                      />
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">{featured.author.name}</h4>
                        <p className="text-[10px] text-slate-500">{featured.author.role}</p>
                      </div>
                    </div>

                    <span className="text-xs font-bold text-indigo-600 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                      Read Article →
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          </section>
        )}

        {/* Blog Grid */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {filteredPosts.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              No articles found matching "{searchQuery}". Try searching for another topic.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredPosts.map((post) => (
                <Link
                  key={post.id}
                  to={`/blog/${post.slug}`}
                  className="group block"
                >
                  <Card className="h-full border-slate-200/90 bg-white card-glow overflow-hidden flex flex-col justify-between">
                    <div>
                      <div className="h-48 overflow-hidden">
                        <img
                          src={post.coverImage}
                          alt={post.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>

                      <CardContent className="p-6 space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <Badge variant="secondary">{post.category}</Badge>
                          <span className="text-slate-400 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {post.readTime}
                          </span>
                        </div>

                        <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug">
                          {post.title}
                        </h3>

                        <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                          {post.excerpt}
                        </p>
                      </CardContent>
                    </div>

                    <div className="px-6 pb-6 pt-0 border-t border-slate-100 mt-auto flex items-center justify-between">
                      <div className="flex items-center gap-2 pt-3">
                        <img
                          src={post.author.avatar}
                          alt={post.author.name}
                          className="h-7 w-7 rounded-full object-cover"
                        />
                        <span className="text-xs font-semibold text-slate-700">
                          {post.author.name}
                        </span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all pt-3" />
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
