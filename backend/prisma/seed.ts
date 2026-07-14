  import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seeding...');

  // 1. Create Roles
  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: { name: 'ADMIN' },
  });

  const userRole = await prisma.role.upsert({
    where: { name: 'USER' },
    update: {},
    create: { name: 'USER' },
  });

  console.log('Roles created: ADMIN and USER.');

  // 2. Create an initial admin only when explicit credentials are provided.
  // Never ship a public, predictable production password.
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    if (adminPassword.length < 12) {
      throw new Error('SEED_ADMIN_PASSWORD must contain at least 12 characters.');
    }
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: { roleId: adminRole.id, password: passwordHash, isVerified: true, isLocked: false },
      create: {
        email: adminEmail,
        username: process.env.SEED_ADMIN_USERNAME?.trim() || 'admin',
        password: passwordHash,
        isVerified: true,
        roleId: adminRole.id,
      },
    });
    console.log(`Initial admin ensured for ${adminEmail}.`);
  } else {
    console.log('Skipping initial admin creation; SEED_ADMIN_EMAIL/PASSWORD are not set.');
  }

  // 3. Create editable VIP plans. These values are safe defaults for mock testing.
  const vipPlans = [
    { code: 'VIP_30', name: 'VIP 1 Tháng', description: 'Truy cập toàn bộ nội dung VIP trong 30 ngày.', price: 39000, durationDays: 30, displayOrder: 1 },
    { code: 'VIP_90', name: 'VIP 3 Tháng', description: 'Tiết kiệm hơn với 90 ngày xem phim VIP.', price: 99000, durationDays: 90, displayOrder: 2 },
    { code: 'VIP_365', name: 'VIP 1 Năm', description: 'Trải nghiệm VIP trọn năm với mức giá tốt nhất.', price: 299000, durationDays: 365, displayOrder: 3 },
  ];
  for (const plan of vipPlans) {
    await prisma.vipPlan.upsert({
      where: { code: plan.code },
      update: {},
      create: plan,
    });
  }
  console.log('VIP plans ensured.');

  // 4. Create Countries
  const countriesData = [
    { name: 'Mỹ', slug: 'my' },
    { name: 'Hàn Quốc', slug: 'han-quoc' },
    { name: 'Nhật Bản', slug: 'nhat-ban' },
    { name: 'Việt Nam', slug: 'viet-nam' },
    { name: 'Trung Quốc', slug: 'trung-quoc' },
  ];

  const countries: any = {};
  for (const c of countriesData) {
    countries[c.slug] = await prisma.country.upsert({
      where: { name: c.name },
      update: {},
      create: c,
    });
  }

  // 5. Create Genres
  const genresData = [
    { name: 'Hành Động', slug: 'hanh-dong' },
    { name: 'Viễn Tưởng', slug: 'vien-tuong' },
    { name: 'Kinh Dị', slug: 'kinh-di' },
    { name: 'Hoạt Hình', slug: 'hoat-hinh' },
    { name: 'Tình Cảm', slug: 'tinh-cam' },
    { name: 'Phiêu Lưu', slug: 'phieu-luu' },
    { name: 'Kịch Tính', slug: 'kich-tinh' },
  ];

  const genres: any = {};
  for (const g of genresData) {
    genres[g.slug] = await prisma.genre.upsert({
      where: { name: g.name },
      update: {},
      create: g,
    });
  }

  // 6. Create Actors & Directors
  const actorsData = [
    { name: 'Keanu Reeves', slug: 'keanu-reeves', avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=100&q=80' },
    { name: 'Scarlett Johansson', slug: 'scarlett-johansson', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80' },
    { name: 'Leonardo DiCaprio', slug: 'leonardo-dicaprio', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80' },
    { name: 'Cổ Lực Na Trát', slug: 'co-luc-na-trat', avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=100&q=80' },
  ];

  const actors: any = {};
  for (const a of actorsData) {
    actors[a.slug] = await prisma.actor.upsert({
      where: { slug: a.slug },
      update: {},
      create: a,
    });
  }

  const directorsData = [
    { name: 'Christopher Nolan', slug: 'christopher-nolan', avatarUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=100&q=80' },
    { name: 'Lana Wachowski', slug: 'lana-wachowski', avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=100&q=80' },
  ];

  const directors: any = {};
  for (const d of directorsData) {
    directors[d.slug] = await prisma.director.upsert({
      where: { slug: d.slug },
      update: {},
      create: d,
    });
  }

  // 7. Create Movies & Series
  const existingMoviesCount = await prisma.movie.count();
  if (existingMoviesCount > 0) {
    console.log('Movies already exist in database. Skipping movie seeding.');
    console.log('Seeding completed successfully!');
    return;
  }

  const moviesData = [
    {
      title: 'Ma Trận Hồi Sinh',
      englishTitle: 'The Matrix Resurrections',
      slug: 'ma-tran-hoi-sinh',
      description: 'Tiếp nối câu chuyện từ ba phần trước, Neo đang sống một cuộc sống bình thường tại San Francisco dưới danh tính Thomas A. Anderson. Tuy nhiên, anh liên tục gặp những ảo ảnh kỳ lạ và phải tìm lại chính mình khi cánh cổng Ma Trận một lần nữa mở ra.',
      backdropUrl: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=1200&q=80',
      posterUrl: 'https://images.unsplash.com/photo-1509347528160-9a9e33742cdb?auto=format&fit=crop&w=400&q=80',
      releaseYear: 2021,
      duration: 148,
      quality: 'FHD',
      isSeries: false,
      episodeCount: 1,
      status: 'Completed',
      views: 1250,
      ratingAvg: 8.5,
      isFeatured: true,
      isTrending: true,
      isProposed: true,
      countrySlug: 'my',
      genreSlugs: ['hanh-dong', 'vien-tuong', 'phieu-luu'],
      actorSlugs: ['keanu-reeves'],
      directorSlugs: ['lana-wachowski'],
      trailerUrl: 'https://www.youtube.com/embed/9ix7TMcq-84',
      episodes: [
        {
          title: 'Full',
          episodeOrder: 1,
          sources: [
            {
              server: 'Main Server',
              quality: '1080p',
              url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
              type: 'hls',
            },
            {
              server: 'Backup Server',
              quality: '720p',
              url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
              type: 'mp4',
            }
          ]
        }
      ]
    },
    {
      title: 'Kẻ Kiến Tạo',
      englishTitle: 'Inception',
      slug: 'ke-kien-tao',
      description: 'Dom Cobb là một kẻ cắp chuyên nghiệp, người có khả năng xâm nhập vào tiềm thức của người khác để đánh cắp các bí mật thông qua những giấc mơ. Lần này, anh được giao một nhiệm vụ ngược lại: cấy ghép một ý tưởng vào tiềm thức của một CEO.',
      backdropUrl: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=80',
      posterUrl: 'https://images.unsplash.com/photo-1535083783855-76ae62b2914e?auto=format&fit=crop&w=400&q=80',
      releaseYear: 2010,
      duration: 148,
      quality: '4K',
      isSeries: false,
      episodeCount: 1,
      status: 'Completed',
      views: 9820,
      ratingAvg: 9.2,
      isFeatured: true,
      isTrending: true,
      isProposed: false,
      countrySlug: 'my',
      genreSlugs: ['vien-tuong', 'hanh-dong', 'kich-tinh'],
      actorSlugs: ['leonardo-dicaprio'],
      directorSlugs: ['christopher-nolan'],
      trailerUrl: 'https://www.youtube.com/embed/YoHD9XEInc0',
      episodes: [
        {
          title: 'Full',
          episodeOrder: 1,
          sources: [
            {
              server: 'Main Server',
              quality: '1080p',
              url: 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8',
              type: 'hls',
            }
          ]
        }
      ]
    },
    {
      title: 'Cựu Chiến Binh: Hồi Kết',
      englishTitle: 'Vanguard: The Last Hope',
      slug: 'cuu-chien-binh-hoi-ket',
      description: 'Trong một tương lai giả định, khi thế giới đứng bên bờ vực sụp đổ vì tài nguyên cạn kiệt, một nhóm lính đánh thuê được dẫn dắt bởi một cựu chiến binh huyền thoại phải thực hiện nhiệm vụ cuối cùng bảo vệ lò phản ứng hạt nhân hạt nhân.',
      backdropUrl: 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?auto=format&fit=crop&w=1200&q=80',
      posterUrl: 'https://images.unsplash.com/photo-1618336753974-aae8e04506aa?auto=format&fit=crop&w=400&q=80',
      releaseYear: 2023,
      duration: 120,
      quality: 'HD',
      isSeries: false,
      episodeCount: 1,
      status: 'Completed',
      views: 450,
      ratingAvg: 7.4,
      isFeatured: false,
      isTrending: false,
      isProposed: true,
      countrySlug: 'trung-quoc',
      genreSlugs: ['hanh-dong', 'kich-tinh'],
      actorSlugs: ['co-luc-na-trat'],
      directorSlugs: ['christopher-nolan'],
      trailerUrl: 'https://www.youtube.com/embed/9ix7TMcq-84',
      episodes: [
        {
          title: 'Full',
          episodeOrder: 1,
          sources: [
            {
              server: 'Main Server',
              quality: '1080p',
              url: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
              type: 'hls',
            }
          ]
        }
      ]
    },
    {
      title: 'Trò Chơi Vương Quyền (Mùa 1)',
      englishTitle: 'Game of Thrones (Season 1)',
      slug: 'tro-choi-vuong-quyen-1',
      description: 'Cuộc chiến giành ngai sắt Iron Throne giữa các gia tộc quý tộc lớn ở lục địa Westeros bắt đầu bùng nổ, kéo theo vô số âm mưu chính trị, phản bội và sự thức tỉnh của một thế lực cổ xưa huyền bí ở phía Bắc.',
      backdropUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
      posterUrl: 'https://images.unsplash.com/photo-1543536448-d209d2d13a1c?auto=format&fit=crop&w=400&q=80',
      releaseYear: 2011,
      duration: 600,
      quality: 'FHD',
      isSeries: true,
      episodeCount: 3,
      status: 'Completed',
      views: 8900,
      ratingAvg: 9.5,
      isFeatured: true,
      isTrending: false,
      isProposed: true,
      countrySlug: 'my',
      genreSlugs: ['kich-tinh', 'phieu-luu'],
      actorSlugs: ['scarlett-johansson'],
      directorSlugs: ['lana-wachowski'],
      trailerUrl: 'https://www.youtube.com/embed/bjqEWgDVycc',
      episodes: [
        {
          title: 'Tập 1',
          episodeOrder: 1,
          sources: [
            {
              server: 'Main Server',
              quality: '1080p',
              url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
              type: 'hls',
            }
          ]
        },
        {
          title: 'Tập 2',
          episodeOrder: 2,
          sources: [
            {
              server: 'Main Server',
              quality: '1080p',
              url: 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8',
              type: 'hls',
            }
          ]
        },
        {
          title: 'Tập 3',
          episodeOrder: 3,
          sources: [
            {
              server: 'Main Server',
              quality: '1080p',
              url: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
              type: 'hls',
            }
          ]
        }
      ]
    }
  ];

  for (const m of moviesData) {
    const movie = await prisma.movie.create({
      data: {
        title: m.title,
        englishTitle: m.englishTitle,
        slug: m.slug,
        description: m.description,
        backdropUrl: m.backdropUrl,
        posterUrl: m.posterUrl,
        releaseYear: m.releaseYear,
        duration: m.duration,
        quality: m.quality,
        isSeries: m.isSeries,
        episodeCount: m.episodeCount,
        status: m.status,
        views: m.views,
        ratingAvg: m.ratingAvg,
        isFeatured: m.isFeatured,
        isTrending: m.isTrending,
        isProposed: m.isProposed,
        trailerUrl: m.trailerUrl,
        countryId: countries[m.countrySlug].id,
        movieGenres: {
          create: m.genreSlugs.map((slug) => ({
            genreId: genres[slug].id,
          })),
        },
        movieActors: {
          create: m.actorSlugs.map((slug) => ({
            actorId: actors[slug].id,
          })),
        },
        movieDirectors: {
          create: m.directorSlugs.map((slug) => ({
            directorId: directors[slug].id,
          })),
        },
      },
    });

    console.log(`Movie created: ${movie.title}`);

    // Create episodes & video sources
    for (const epData of m.episodes) {
      const ep = await prisma.episode.create({
        data: {
          movieId: movie.id,
          title: epData.title,
          episodeOrder: epData.episodeOrder,
        },
      });

      for (const src of epData.sources) {
        await prisma.videoSource.create({
          data: {
            episodeId: ep.id,
            server: src.server,
            quality: src.quality,
            url: src.url,
            type: src.type,
          },
        });
      }

      // Add default subtitles
      await prisma.subtitle.create({
        data: {
          episodeId: ep.id,
          language: 'Vietnamese',
          url: 'https://example.com/subs/vi.vtt',
        },
      });
      await prisma.subtitle.create({
        data: {
          episodeId: ep.id,
          language: 'English',
          url: 'https://example.com/subs/en.vtt',
        },
      });
    }

    // Link featured or trending movies to Banner
    if (m.isFeatured) {
      await prisma.banner.create({
        data: {
          movieId: movie.id,
          title: movie.title,
          description: movie.description.slice(0, 150) + '...',
          imageUrl: movie.backdropUrl,
          order: m.title === 'Ma Trận Hồi Sinh' ? 1 : 2,
        },
      });
      console.log(`Banner created for: ${movie.title}`);
    }
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
