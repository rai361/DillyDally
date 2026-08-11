interface UserProfile {
    bio: string;
    followers: number;
    following: number;
    avatarUrl: string;
    displayName: string;
}

type Category = 'User Submitted' | 'Promoted' | 'Food!' | 'Parks';

interface Spot {
  id: string;
  position: [number, number];
  title: string;
  description: string;
  image: string;
  price: 1 | 2 | 3 | 4; // out of 4
  hype: 1 | 2 | 3 | 4 | 5; // out of 5
  time: string;
  category: Category;
  tags: string[];
}

interface GalleryImage {
  id: string;
  imageUrl: string;
  caption: string;
}

export { UserProfile, Category, Spot, GalleryImage };