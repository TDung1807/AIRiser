import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Brain, Target, Calendar, ArrowRight, CheckCircle, MessageCircle, LogIn } from 'lucide-react';

const LandingPage: React.FC = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-purple-300 selection:text-purple-900">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900 text-white py-20 lg:py-32">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="text-center max-w-3xl mx-auto"
          >
            <motion.h1 variants={itemVariants} className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-200 to-purple-200 leading-tight py-2">
              Khám phá con đường học tập của riêng bạn
            </motion.h1>
            <motion.p variants={itemVariants} className="text-xl md:text-2xl text-blue-100 mb-10 leading-relaxed">
              MyPath AI sử dụng trí tuệ nhân tạo để giúp bạn hiểu bản thân, chọn ngành phù hợp và xây dựng kế hoạch học tập cá nhân hóa.
            </motion.p>
            <motion.div variants={itemVariants} className="flex flex-col sm:flex-row justify-center items-center gap-4">
              <Link 
                to="/login" 
                className="w-full sm:w-auto px-8 py-4 bg-white text-indigo-900 rounded-full font-bold text-lg hover:bg-blue-50 transition-colors shadow-lg hover:shadow-xl flex items-center justify-center gap-2 group"
              >
                Bắt đầu ngay
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a 
                href="#features" 
                className="w-full sm:w-auto px-8 py-4 bg-transparent border-2 border-white/30 hover:border-white text-white rounded-full font-bold text-lg transition-colors flex items-center justify-center"
              >
                Tìm hiểu thêm
              </a>
            </motion.div>
          </motion.div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute top-0 left-0 -mt-20 -ml-20 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Các tính năng nổi bật</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">Trải nghiệm quá trình tư vấn hướng nghiệp toàn diện với sự hỗ trợ của AI.</p>
          </div>
          
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={containerVariants}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {/* Card 1 */}
            <motion.div variants={itemVariants} className="bg-gray-50 rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow border border-gray-100">
              <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-6">
                <Brain className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900">Hiểu bản thân</h3>
              <p className="text-gray-600 leading-relaxed">
                AI trò chuyện để tìm hiểu sở thích, điểm mạnh và phong cách học tập của bạn thông qua các câu hỏi khơi gợi thông minh.
              </p>
            </motion.div>

            {/* Card 2 */}
            <motion.div variants={itemVariants} className="bg-gray-50 rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow border border-gray-100">
              <div className="w-14 h-14 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center mb-6">
                <Target className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900">Chọn ngành phù hợp</h3>
              <p className="text-gray-600 leading-relaxed">
                Nhận đề xuất ngành học dựa trên hồ sơ cá nhân với giải thích chi tiết, so sánh cơ hội việc làm và mức độ phù hợp.
              </p>
            </motion.div>

            {/* Card 3 */}
            <motion.div variants={itemVariants} className="bg-gray-50 rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow border border-gray-100">
              <div className="w-14 h-14 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mb-6">
                <Calendar className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900">Lên kế hoạch thực tế</h3>
              <p className="text-gray-600 leading-relaxed">
                Tạo lịch học tự động trên Google Calendar phù hợp với thời gian thực tế, kèm theo nhắc nhở và theo dõi tiến độ.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Cách thức hoạt động</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">Chỉ với 6 bước đơn giản để xây dựng lộ trình học tập tối ưu.</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {[
              { title: "Đăng nhập", icon: <LogIn className="w-6 h-6" /> },
              { title: "Trò chuyện", icon: <MessageCircle className="w-6 h-6" /> },
              { title: "Nhận đề xuất", icon: <Brain className="w-6 h-6" /> },
              { title: "Chọn ngành", icon: <Target className="w-6 h-6" /> },
              { title: "Lập kế hoạch", icon: <Calendar className="w-6 h-6" /> },
              { title: "Đồng bộ hóa", icon: <CheckCircle className="w-6 h-6" /> },
            ].map((step, idx) => (
              <div key={idx} className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-white shadow-md flex items-center justify-center text-indigo-600 mb-4 border border-indigo-50 relative z-10">
                  {step.icon}
                </div>
                <h4 className="font-semibold text-gray-800">{`Bước ${idx + 1}`}</h4>
                <p className="text-sm text-gray-500 mt-1">{step.title}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center text-center">
          <div className="flex items-center justify-center gap-2 mb-4 text-white">
            <Brain className="w-6 h-6 text-purple-400" />
            <span className="text-xl font-bold tracking-tight">MyPath AI</span>
          </div>
          <p className="mb-4">MyPath AI — Know yourself. Choose your path. Plan your future.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
