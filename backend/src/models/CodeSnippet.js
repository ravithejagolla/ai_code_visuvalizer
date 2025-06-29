
import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database.js'; 

class CodeSnippet extends Model {
  static associate(models) {
    
  }
}

CodeSnippet.init(
  {
    code: {
      type: DataTypes.TEXT,
      allowNull: true, 
    },
    explanation: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    improvements: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    bugs: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    testCases: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  
    imagePrompt: {
      type: DataTypes.TEXT,
      allowNull: true, 
    },
    requestType: {
      type: DataTypes.ENUM('explain', 'improve', 'debug', 'test', 'generateImage'), 
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: 'CodeSnippet',
    tableName: 'CodeSnippets',
    timestamps: true,
  }
);

export default CodeSnippet;