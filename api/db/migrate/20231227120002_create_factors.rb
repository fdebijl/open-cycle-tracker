class CreateFactors < ActiveRecord::Migration[7.0]
  def change
    create_table :factors, id: :uuid do |t|
      t.string :notes

      t.references :day, type: :uuid, null: false, foreign_key: true
      t.references :user, type: :uuid, null: false, foreign_key: true

      t.timestamps
    end
  end
end
